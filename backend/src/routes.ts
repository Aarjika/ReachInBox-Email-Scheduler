import { Router } from 'express';
import { randomUUID } from 'crypto';
import { requireAuth } from './auth';
import { pool } from './db';
import { config } from './config';
import { emailQueue, toJob } from './queue';
import { getSenders } from './senders';
import { indexEmails, searchEmails } from './es';

export const apiRouter = Router();
apiRouter.use(requireAuth);

const uid = (req: any): number => req.userId;
const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB per file
const MAX_TOTAL_BYTES = 25 * 1024 * 1024; // 25 MB per email (Gmail's limit)

// Attachment names/sizes for the email detail view
const ATTACHMENTS_SQL = `COALESCE(
  (SELECT json_agg(json_build_object('filename', a.filename, 'size', a.size)) FROM attachments a WHERE a.id = ANY(e.attachment_ids)),
  '[]'::json) AS attachments`;

apiRouter.get('/me', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, email, name, avatar, (slack_webhook_url IS NOT NULL) AS slack_connected FROM users WHERE id=$1',
    [uid(req)],
  );
  res.json(rows[0]);
});

apiRouter.post('/slack/disconnect', async (req, res) => {
  await pool.query('UPDATE users SET slack_webhook_url=NULL WHERE id=$1', [uid(req)]);
  res.json({ ok: true });
});

apiRouter.post('/emails/schedule', async (req, res) => {
  const { subject, body, recipients, startTime, delaySeconds = 0, hourlyLimit, attachments = [] } = req.body ?? {};
  if (!subject || !body || !Array.isArray(recipients) || !recipients.length || !startTime) {
    return res.status(400).json({ error: 'subject, body, recipients and startTime are required' });
  }
  const start = new Date(startTime).getTime();
  if (Number.isNaN(start)) return res.status(400).json({ error: 'Invalid startTime' });

  if (!Array.isArray(attachments) || attachments.length > MAX_FILES) {
    return res.status(400).json({ error: `You can attach at most ${MAX_FILES} files` });
  }
  const files = attachments.map((a: any) => ({
    filename: String(a?.filename ?? '').slice(0, 255),
    contentType: String(a?.contentType || 'application/octet-stream'),
    buffer: Buffer.from(String(a?.data ?? ''), 'base64'),
  }));
  if (files.some((f) => !f.filename || !f.buffer.length)) {
    return res.status(400).json({ error: 'Invalid attachment' });
  }
  if (files.some((f) => f.buffer.length > MAX_FILE_BYTES)) {
    return res.status(400).json({ error: 'Each attachment must be 10 MB or smaller' });
  }

  if (files.reduce((n, f) => n + f.buffer.length, 0) > MAX_TOTAL_BYTES) {
    return res.status(400).json({ error: 'Total attachments must be 25 MB or smaller' });
  }

  const limit = Number(hourlyLimit) > 0 ? Number(hourlyLimit) : config.maxEmailsPerHourPerSender;
  const delayMs = Math.max(0, Number(delaySeconds)) * 1000;
  const senders = await getSenders();
  const unique = [...new Set<string>(recipients.map((r: string) => String(r).trim().toLowerCase()))].filter(Boolean);

  // Store each attachment once; every email just references the ids
  const attachmentIds: string[] = [];
  for (const f of files) {
    const aid = randomUUID();
    await pool.query(
      'INSERT INTO attachments(id, user_id, filename, content_type, size, data) VALUES ($1,$2,$3,$4,$5,$6)',
      [aid, uid(req), f.filename, f.contentType, f.buffer.length, f.buffer],
    );
    attachmentIds.push(aid);
  }

  const rows: any[] = [];
  const jobs = [];
  for (let i = 0; i < unique.length; i++) {
    const id = randomUUID();
    const sender = senders[i % senders.length]; // round-robin across senders
    const scheduledAt = new Date(start + i * delayMs);
    const { rows: r } = await pool.query(
      `INSERT INTO emails(id, user_id, sender_id, recipient, subject, body, hourly_limit, scheduled_at, attachment_ids)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::uuid[]) RETURNING *`,
      [id, uid(req), sender.id, unique[i], subject, body, limit, scheduledAt, attachmentIds],
    );
    rows.push(r[0]);
    jobs.push(toJob({ emailId: id, userId: uid(req), senderId: sender.id, hourlyLimit: limit }, scheduledAt));
  }
  await emailQueue.addBulk(jobs);
  await indexEmails(rows);
  res.json({ scheduled: rows.length });
});

apiRouter.get('/emails/scheduled', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT e.id, e.recipient, e.subject, e.body, e.scheduled_at, e.status, ${ATTACHMENTS_SQL}
     FROM emails e
     WHERE e.user_id=$1 AND e.status IN ('scheduled','sending') ORDER BY e.scheduled_at ASC LIMIT 500`,
    [uid(req)],
  );
  res.json(rows);
});

apiRouter.get('/emails/sent', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT e.id, e.recipient, e.subject, e.body, e.sent_at, e.status, ${ATTACHMENTS_SQL}
     FROM emails e
     WHERE e.user_id=$1 AND e.status IN ('sent','failed') ORDER BY e.sent_at DESC LIMIT 500`,
    [uid(req)],
  );
  res.json(rows);
});

apiRouter.get('/emails/search', async (req, res) => {
  res.json(await searchEmails(uid(req), String(req.query.q ?? '')));
});
