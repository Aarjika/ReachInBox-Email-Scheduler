import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { config } from './config';
import { pool } from './db';

export const authRouter = Router();

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const p = jwt.verify(req.cookies.token, config.jwtSecret) as { userId: number };
    (req as any).userId = p.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Not authenticated' });
  }
}

const hashPassword = (pw: string) => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(pw, salt, 64).toString('hex')}`;
};
const checkPassword = (pw: string, stored: string) => {
  const [salt, hash] = stored.split(':');
  const a = Buffer.from(hash, 'hex');
  const b = scryptSync(pw, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
};
const setSession = (res: Response, userId: number) => {
  const token = jwt.sign({ userId }, config.jwtSecret, { expiresIn: '7d' });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 86400_000 });
};

// ---------- Email + password ----------
// Same form signs in existing users and signs up new ones ("or sign up through email").
authRouter.post('/login', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const { rows } = await pool.query('SELECT id, google_id, password_hash FROM users WHERE lower(email)=$1', [email]);
  const pwUser = rows.find((u) => u.password_hash);
  if (pwUser) {
    if (!checkPassword(password, pwUser.password_hash)) return res.status(401).json({ error: 'Incorrect email or password' });
    setSession(res, pwUser.id);
    return res.json({ ok: true });
  }
  if (rows.length) {
    return res.status(400).json({ error: 'This email is registered with Google. Please use "Login with Google".' });
  }
  const created = await pool.query(
    'INSERT INTO users(email, name, password_hash) VALUES ($1,$2,$3) RETURNING id',
    [email, email.split('@')[0], hashPassword(password)],
  );
  setSession(res, created.rows[0].id);
  res.json({ ok: true });
});

// ---------- Google OAuth ----------
authRouter.get('/google', (_req, res) => {
  const p = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: `${config.backendUrl}/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${p}`);
});

authRouter.get('/google/callback', async (req, res) => {
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(req.query.code),
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        redirect_uri: `${config.backendUrl}/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });
    const tokens: any = await tokenRes.json();
    if (!tokens.access_token) throw new Error('No access token');
    const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const info: any = await infoRes.json();
    const { rows } = await pool.query(
      `INSERT INTO users(google_id, email, name, avatar) VALUES ($1,$2,$3,$4)
       ON CONFLICT (google_id) DO UPDATE SET email=$2, name=$3, avatar=$4 RETURNING id`,
      [info.sub, info.email, info.name, info.picture],
    );
    setSession(res, rows[0].id);
    res.redirect(config.frontendUrl);
  } catch (e) {
    console.error('[auth] google failed', e);
    res.redirect(`${config.frontendUrl}?error=login_failed`);
  }
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

// ---------- Slack OAuth (incoming-webhook scope) ----------
authRouter.get('/slack', requireAuth, (req, res) => {
  const state = jwt.sign({ userId: (req as any).userId }, config.jwtSecret, { expiresIn: '10m' });
  const p = new URLSearchParams({
    client_id: config.slack.clientId,
    scope: 'incoming-webhook',
    redirect_uri: config.slack.redirectUri,
    state,
  });
  res.redirect(`https://slack.com/oauth/v2/authorize?${p}`);
});

authRouter.get('/slack/callback', async (req, res) => {
  try {
    const { userId } = jwt.verify(String(req.query.state), config.jwtSecret) as { userId: number };
    const r = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(req.query.code),
        client_id: config.slack.clientId,
        client_secret: config.slack.clientSecret,
        redirect_uri: config.slack.redirectUri,
      }),
    });
    const data: any = await r.json();
    const url = data?.incoming_webhook?.url;
    if (!data.ok || !url) throw new Error(data.error || 'No webhook returned');
    await pool.query('UPDATE users SET slack_webhook_url=$1 WHERE id=$2', [url, userId]);
    res.redirect(`${config.frontendUrl}?slack=connected`);
  } catch (e) {
    console.error('[auth] slack failed', e);
    res.redirect(`${config.frontendUrl}?slack=error`);
  }
});
