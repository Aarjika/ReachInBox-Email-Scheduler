import nodemailer from 'nodemailer';
import { Worker, Job, DelayedError } from 'bullmq';
import { config } from './config';
import { pool } from './db';
import { connection, QUEUE_NAME, EmailJobData } from './queue';
import { getSenderById, getTransport } from './senders';
import { indexEmails } from './es';

const HOUR = 3600_000;

async function notifySlack(userId: number, senderEmail: string, limit: number, hourWindow: number) {
  const { rows } = await pool.query('SELECT slack_webhook_url FROM users WHERE id=$1', [userId]);
  const url: string | null = rows[0]?.slack_webhook_url;
  if (!url) return; // Slack not connected -> silently skip
  // one notification per sender per hour window
  const first = await connection.set(`rl:notified:${senderEmail}:${hourWindow}`, '1', 'EX', 2 * 3600, 'NX');
  if (!first) return;
  try {
    const resumes = new Date((hourWindow + 1) * HOUR).toLocaleTimeString();
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `:warning: Hourly limit reached for sender *${senderEmail}* (${limit}/hour). Remaining emails are rescheduled and resume at ${resumes}.`,
      }),
    });
  } catch (e) {
    console.warn('[slack] notify failed', (e as Error).message);
  }
}

async function processEmail(job: Job<EmailJobData>, token?: string) {
  const { emailId, userId, senderId, hourlyLimit } = job.data;
  const limit = hourlyLimit || config.maxEmailsPerHourPerSender;
  const sender = await getSenderById(senderId);
  if (!sender) {
    await pool.query(`UPDATE emails SET status='failed', sent_at=now(), error='Sender not found' WHERE id=$1`, [emailId]);
    throw new Error(`Sender ${senderId} not found`);
  }

  // Hourly rate limit: Redis counter keyed by sender + hour window (shared by all workers)
  const hourWindow = Math.floor(Date.now() / HOUR);
  const key = `rl:${senderId}:${hourWindow}`;
  const count = await connection.incr(key);
  if (count === 1) await connection.expire(key, 2 * 3600);
  if (count > limit) {
    await connection.decr(key);
    await notifySlack(userId, sender.email, limit, hourWindow);
    // Not dropped, not failed: moved to the start of the next hour window
    await job.moveToDelayed((hourWindow + 1) * HOUR + 1000, token);
    throw new DelayedError();
  }

  // Idempotency: only one worker can flip scheduled -> sending
  const claim = await pool.query(
    `UPDATE emails SET status='sending' WHERE id=$1 AND status='scheduled' RETURNING *`,
    [emailId],
  );
  if (claim.rowCount === 0) {
    await connection.decr(key); // already handled elsewhere, give the slot back
    return;
  }
  const email = claim.rows[0];

  try {
    const attachments = email.attachment_ids?.length
      ? (
          await pool.query('SELECT filename, content_type, data FROM attachments WHERE id = ANY($1::uuid[])', [email.attachment_ids])
        ).rows.map((a) => ({ filename: a.filename, contentType: a.content_type, content: a.data }))
      : [];
    const info = await getTransport(sender).sendMail({
      from: sender.email,
      to: email.recipient,
      subject: email.subject,
      text: email.body,
      attachments,
    });
    const preview = nodemailer.getTestMessageUrl(info); // only set for Ethereal
    console.log(`[sent] ${email.recipient} via ${sender.email}${preview ? ` preview: ${preview}` : ''}`);
    const r = await pool.query(`UPDATE emails SET status='sent', sent_at=now() WHERE id=$1 RETURNING *`, [emailId]);
    await indexEmails(r.rows);
  } catch (err) {
    console.error(`[send failed] ${email.recipient} via ${sender.email}: ${(err as Error).message}`);
    const r = await pool.query(
      `UPDATE emails SET status='failed', sent_at=now(), error=$2 WHERE id=$1 RETURNING *`,
      [emailId, (err as Error).message],
    );
    await indexEmails(r.rows);
    // Re-throw so BullMQ also marks the job as FAILED (visible in the Bull dashboard).
    // The job is not retried because the queue uses attempts: 1.
    throw err;
  }
}

export function startWorker() {
  const worker = new Worker<EmailJobData>(QUEUE_NAME, processEmail, {
    connection,
    concurrency: config.workerConcurrency,
    // Minimum delay between sends: at most 1 job per MIN_DELAY_BETWEEN_EMAILS_MS across all workers
    limiter: { max: 1, duration: config.minDelayMs },
  });
  worker.on('failed', (job, err) => console.error(`[worker] job ${job?.id} failed:`, err.message));
  console.log(`[worker] concurrency=${config.workerConcurrency} minDelay=${config.minDelayMs}ms`);
  return worker;
}
