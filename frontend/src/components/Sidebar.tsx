import { useState } from 'react';
import { API_URL, api } from '../api';
import type { User } from '../types';
import { Avatar } from './ui';
import { ChevronDownIcon, ClockIcon, SendIcon } from './icons';

export type Tab = 'scheduled' | 'sent';

export function Sidebar({
  user, onChange, tab, onTab, counts, onCompose,
}: {
  user: User;
  onChange: () => void;
  tab: Tab;
  onTab: (t: Tab) => void;
  counts: { scheduled: number; sent: number };
  onCompose: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  // Same handlers as the old Header
  const logout = async () => { await api.logout(); onChange(); };
  const disconnectSlack = async () => { await api.slackDisconnect(); setMenuOpen(false); onChange(); };

  const navItem = (t: Tab, label: string, icon: React.ReactNode, count: number) => (
    <button
      onClick={() => onTab(t)}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm ${tab === t ? 'bg-brand-soft font-semibold' : 'text-gray-700 hover:bg-surface'}`}
    >
      {icon}
      <span className="flex-1">{label}</span>
      <span className="text-xs text-gray-500">{count}</span>
    </button>
  );

  return (
    <aside className="flex w-[220px] shrink-0 flex-col gap-4 p-4">
      <div className="font-pixel whitespace-nowrap text-[19px] leading-none tracking-tight">ReachInBox</div>
      <div className="relative">
        <button onClick={() => setMenuOpen((o) => !o)} className="flex w-full items-center gap-2.5 rounded-xl bg-surface px-2.5 py-2 text-left">
          <Avatar src={user.avatar} name={user.name} size={32} />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-xs font-medium">{user.name}</div>
            <div className="truncate text-[10px] text-gray-500">{user.email}</div>
          </div>
          <ChevronDownIcon size={14} className="text-gray-400" />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-line bg-white text-sm shadow-lg">
              {user.slack_connected ? (
                <button onClick={disconnectSlack} className="block w-full px-4 py-2.5 text-left hover:bg-surface">Disconnect Slack</button>
              ) : (
                <a href={`${API_URL}/auth/slack`} className="block px-4 py-2.5 hover:bg-surface">Connect Slack</a>
              )}
              <button onClick={logout} className="block w-full px-4 py-2.5 text-left hover:bg-surface">Logout</button>
            </div>
          </>
        )}
      </div>

      <button onClick={onCompose} className="rounded-full border border-brand py-1.5 text-sm font-medium text-brand transition hover:bg-brand-soft">
        Compose
      </button>

      <nav className="space-y-1">
        <div className="px-1 pb-1 text-[10px] font-medium tracking-wide text-gray-400">CORE</div>
        {navItem('scheduled', 'Scheduled', <ClockIcon size={16} />, counts.scheduled)}
        {navItem('sent', 'Sent', <SendIcon size={16} />, counts.sent)}
      </nav>
    </aside>
  );
}
