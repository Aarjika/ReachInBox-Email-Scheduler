import nodemailer from 'nodemailer';
import { pool } from './db';
import { config } from './config';

export interface Sender {
  id: number;
  email: string;
  smtp_user: string;
  smtp_pass: string;
  smtp_host: string | null; // NULL = Ethereal
  smtp_port: number | null;
  smtp_secure: boolean | null;
}

// Real SMTP mode (SMTP_HOST set): one sender built from .env.
// Ethereal mode (default): fake accounts are created once, stored in the DB and reused after restarts.
export async function ensureSenders() {
  if (config.smtp.host) {
    const from = config.smtp.from || config.smtp.user;
    await pool.query(
      `INSERT INTO senders(email, smtp_user, smtp_pass, smtp_host, smtp_port, smtp_secure)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (email) DO UPDATE
       SET smtp_user=$2, smtp_pass=$3, smtp_host=$4, smtp_port=$5, smtp_secure=$6`,
      [from, config.smtp.user, config.smtp.pass, config.smtp.host, config.smtp.port, config.smtp.secure],
    );
    console.log(`[senders] real SMTP mode: ${from} via ${config.smtp.host}:${config.smtp.port}`);
    return;
  }
  const { rows } = await pool.query('SELECT COUNT(*)::int AS c FROM senders WHERE smtp_host IS NULL');
  for (let i = rows[0].c; i < config.senderCount; i++) {
    const acc = await nodemailer.createTestAccount();
    await pool.query('INSERT INTO senders(email, smtp_user, smtp_pass) VALUES ($1,$2,$3)', [acc.user, acc.user, acc.pass]);
    console.log(`[senders] created Ethereal sender ${acc.user}`);
  }
}

// Senders used for NEW emails (depends on the current SMTP mode)
export async function getSenders(): Promise<Sender[]> {
  const { rows } = config.smtp.host
    ? await pool.query('SELECT * FROM senders WHERE smtp_host = $1 AND smtp_user = $2 ORDER BY id', [config.smtp.host, config.smtp.user])
    : await pool.query('SELECT * FROM senders WHERE smtp_host IS NULL ORDER BY id');
  return rows;
}

// Any sender, regardless of mode (jobs queued before a mode switch still need their sender)
export async function getSenderById(id: number): Promise<Sender | undefined> {
  const { rows } = await pool.query('SELECT * FROM senders WHERE id=$1', [id]);
  return rows[0];
}

const transports = new Map<number, nodemailer.Transporter>();
export function getTransport(s: Sender) {
  let t = transports.get(s.id);
  if (!t) {
    t = nodemailer.createTransport({
      host: s.smtp_host ?? 'smtp.ethereal.email',
      port: s.smtp_port ?? 587,
      secure: s.smtp_secure ?? false,
      connectionTimeout: 15000,
      auth: { user: s.smtp_user, pass: s.smtp_pass },
    });
    transports.set(s.id, t);
  }
  return t;
}
