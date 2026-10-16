import type { User, ScheduledEmail, SentEmail, ScheduleRequest } from './types';

export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API_URL + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? res.statusText);
  }
  return res.json();
}

export const api = {
  me: () => request<User>('/api/me'),
  login: (email: string, password: string) =>
    request<{ ok: boolean }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  scheduled: () => request<ScheduledEmail[]>('/api/emails/scheduled'),
  sent: () => request<SentEmail[]>('/api/emails/sent'),
  schedule: (body: ScheduleRequest) =>
    request<{ scheduled: number }>('/api/emails/schedule', { method: 'POST', body: JSON.stringify(body) }),
  slackDisconnect: () => request<{ ok: boolean }>('/api/slack/disconnect', { method: 'POST' }),
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
};
