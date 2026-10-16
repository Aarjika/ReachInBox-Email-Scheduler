import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { ScheduledEmail, SentEmail, User } from '../types';
import { Sidebar, type Tab } from '../components/Sidebar';
import { ComposePage } from '../components/ComposePage';
import { EmailList, type ListRow } from '../components/EmailList';
import { EmailDetail } from '../components/EmailDetail';
import { FilterIcon, RefreshIcon, SearchIcon } from '../components/icons';
import { Toast } from '../components/ui';

const STAR_KEY = 'starred-emails';
const loadStars = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(STAR_KEY) ?? '[]')); } catch { return new Set(); }
};

const STATUS_OPTIONS: Record<Tab, string[]> = {
  scheduled: ['all', 'scheduled', 'sending'],
  sent: ['all', 'sent', 'failed'],
};

export default function Dashboard({ user, onUserChange }: { user: User; onUserChange: () => void }) {
  // ---- existing state & logic (unchanged) ----
  const [tab, setTab] = useState<Tab>('scheduled');
  const [scheduled, setScheduled] = useState<ScheduledEmail[]>([]);
  const [sent, setSent] = useState<SentEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const notify = (message: string, ok: boolean) => {
    setToast({ message, type: ok ? 'success' : 'error' });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([api.scheduled(), api.sent()]);
      setScheduled(a);
      setSent(b);
    } catch (e) {
      notify((e as Error).message, false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000); // keep lists fresh
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const slack = new URLSearchParams(window.location.search).get('slack');
    if (slack) {
      notify(slack === 'connected' ? 'Slack connected' : 'Slack connection failed', slack === 'connected');
      window.history.replaceState({}, '', '/');
      onUserChange();
    }
  }, []);

  // ---- new UI-only state ----
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selected, setSelected] = useState<ListRow | null>(null);
  const [starred, setStarred] = useState<Set<string>>(loadStars);

  const toggleStar = (id: string) =>
    setStarred((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      try { localStorage.setItem(STAR_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });

  const changeTab = (t: Tab) => { setTab(t); setStatusFilter('all'); setFilterOpen(false); };

  const rows: ListRow[] = useMemo(() => {
    const base: ListRow[] =
      tab === 'scheduled'
        ? scheduled.map((r) => ({ id: r.id, recipient: r.recipient, subject: r.subject, body: r.body, attachments: r.attachments, status: r.status, at: r.scheduled_at }))
        : sent.map((r) => ({ id: r.id, recipient: r.recipient, subject: r.subject, body: r.body, attachments: r.attachments, status: r.status, at: r.sent_at }));
    const q = query.trim().toLowerCase();
    return base.filter(
      (r) =>
        (statusFilter === 'all' || r.status === statusFilter) &&
        (!q || r.recipient.toLowerCase().includes(q) || r.subject.toLowerCase().includes(q)),
    );
  }, [tab, scheduled, sent, query, statusFilter]);

  const toastEl = toast && <Toast {...toast} />;

  if (composeOpen) {
    return (
      <>
        <ComposePage user={user} onClose={() => setComposeOpen(false)} onDone={(m, ok) => { notify(m, ok); load(); }} />
        {toastEl}
      </>
    );
  }

  if (selected) {
    return (
      <>
        <EmailDetail row={selected} user={user} starred={starred.has(selected.id)} onToggleStar={() => toggleStar(selected.id)} onBack={() => setSelected(null)} />
        {toastEl}
      </>
    );
  }

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar
        user={user}
        onChange={onUserChange}
        tab={tab}
        onTab={changeTab}
        counts={{ scheduled: scheduled.length, sent: sent.length }}
        onCompose={() => setComposeOpen(true)}
      />
      <main className="min-w-0 flex-1 p-4">
        <div className="mb-3 flex items-center gap-3">
          <label className="flex flex-1 items-center gap-2 rounded-full bg-surface px-4 py-2.5 text-sm">
            <SearchIcon size={16} className="text-gray-500" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search"
              className="flex-1 bg-transparent outline-none placeholder:text-gray-500" />
          </label>
          <div className="relative">
            <button onClick={() => setFilterOpen((o) => !o)} aria-label="Filter" className={statusFilter === 'all' ? 'text-gray-500' : 'text-brand'}>
              <FilterIcon size={18} />
            </button>
            {filterOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
                <ul className="absolute right-0 top-full z-20 mt-2 w-36 overflow-hidden rounded-xl border border-line bg-white text-sm capitalize shadow-lg">
                  {STATUS_OPTIONS[tab].map((s) => (
                    <li key={s}>
                      <button onClick={() => { setStatusFilter(s); setFilterOpen(false); }}
                        className={`block w-full px-4 py-2 text-left hover:bg-surface ${statusFilter === s ? 'font-semibold text-brand' : ''}`}>
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <button onClick={load} aria-label="Refresh" className="text-gray-500 hover:text-gray-800"><RefreshIcon size={18} /></button>
        </div>

        <EmailList
          rows={rows}
          loading={loading}
          emptyMessage={tab === 'scheduled' ? 'No scheduled emails' : 'No sent emails yet'}
          starred={starred}
          onToggleStar={toggleStar}
          onOpen={setSelected}
        />
      </main>
      {toastEl}
    </div>
  );
}
