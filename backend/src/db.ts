import { Pool } from 'pg';
import { config } from './config';

export const pool = new Pool({ connectionString: config.databaseUrl });

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      google_id TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      name TEXT,
      avatar TEXT,
      slack_webhook_url TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS senders (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      smtp_user TEXT NOT NULL,
      smtp_pass TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS emails (
      id UUID PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id),
      sender_id INT NOT NULL REFERENCES senders(id),
      recipient TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      hourly_limit INT NOT NULL,
      scheduled_at TIMESTAMPTZ NOT NULL,
      sent_at TIMESTAMPTZ,
      status TEXT NOT NULL DEFAULT 'scheduled',
      error TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_emails_user_status ON emails(user_id, status);

    -- email/password login
    ALTER TABLE users ALTER COLUMN google_id DROP NOT NULL;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

    -- real SMTP senders (NULL smtp_host = Ethereal)
    ALTER TABLE senders ADD COLUMN IF NOT EXISTS smtp_host TEXT;
    ALTER TABLE senders ADD COLUMN IF NOT EXISTS smtp_port INT;
    ALTER TABLE senders ADD COLUMN IF NOT EXISTS smtp_secure BOOLEAN;

    -- attachments (stored once per schedule request, linked from each email)
    CREATE TABLE IF NOT EXISTS attachments (
      id UUID PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id),
      filename TEXT NOT NULL,
      content_type TEXT NOT NULL,
      size INT NOT NULL,
      data BYTEA NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    ALTER TABLE emails ADD COLUMN IF NOT EXISTS attachment_ids UUID[] NOT NULL DEFAULT '{}';
  `);
}
