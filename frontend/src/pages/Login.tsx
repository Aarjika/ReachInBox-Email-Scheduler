import { useState } from 'react';
import { API_URL, api } from '../api';
import { GoogleIcon } from '../components/icons';

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [notice, setNotice] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Signs in an existing email/password user, or signs up a new one (backend decides).
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice('');
    setSubmitting(true);
    try {
      await api.login(email, password);
      onLogin();
    } catch (err) {
      setNotice((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-4">
      <div className="w-full max-w-[372px] rounded-xl border border-line bg-white p-10">
        <h1 className="mb-6 text-center text-[28px] font-bold">Login</h1>

        <a
          href={`${API_URL}/auth/google`}
          className="flex items-center justify-center gap-2 rounded-lg bg-brand-soft py-2.5 text-sm font-medium transition hover:brightness-95"
        >
          <GoogleIcon size={16} />
          Login with Google
        </a>

        <div className="my-5 flex items-center gap-3 text-[11px] text-muted">
          <span className="h-px flex-1 bg-line" />
          or sign up through email
          <span className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <input type="email" placeholder="Email ID" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full rounded-lg bg-surface px-4 py-3 text-xs outline-none placeholder:text-gray-500" />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full rounded-lg bg-surface px-4 py-3 text-xs outline-none placeholder:text-gray-500" />
          {notice && <p className="text-xs text-red-600">{notice}</p>}
          <button type="submit" disabled={submitting} className="mt-3 w-full rounded-lg bg-brand py-2.5 text-sm font-medium text-white transition hover:bg-brand-dark disabled:opacity-50">
            {submitting ? 'Please wait…' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
