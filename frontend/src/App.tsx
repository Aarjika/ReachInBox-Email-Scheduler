import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import type { User } from './types';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { Spinner } from './components/ui';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try { setUser(await api.me()); } catch { setUser(null); } finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  if (loading) return <div className="py-32"><Spinner /></div>;
  return user ? <Dashboard user={user} onUserChange={refresh} /> : <Login onLogin={refresh} />;
}
