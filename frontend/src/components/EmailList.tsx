import type { AttachmentInfo } from '../types';
import { EmptyState, Spinner } from './ui';
import { ClockIcon, StarIcon } from './icons';

export interface ListRow {
  id: string;
  recipient: string;
  subject: string;
  body?: string;
  attachments?: AttachmentInfo[];
  status: string;
  at: string; // scheduled_at for the Scheduled tab, sent_at for the Sent tab
}

export const shortTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', second: '2-digit' });

export function StatusPill({ status, at }: { status: string; at: string }) {
  if (status === 'scheduled' || status === 'sending') {
    return (
      <span title={new Date(at).toLocaleString()} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-pill-border bg-pill-bg px-2 py-0.5 text-[11px] font-medium text-pill-text">
        <ClockIcon size={11} />
        {status === 'sending' ? 'Sending' : shortTime(at)}
      </span>
    );
  }
  const cls = status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-surface text-gray-600';
  return (
    <span title={new Date(at).toLocaleString()} className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize ${cls}`}>
      {status}
    </span>
  );
}

export function EmailList({
  rows, loading, emptyMessage, starred, onToggleStar, onOpen,
}: {
  rows: ListRow[];
  loading: boolean;
  emptyMessage: string;
  starred: Set<string>;
  onToggleStar: (id: string) => void;
  onOpen: (row: ListRow) => void;
}) {
  if (loading) return <div className="py-16"><Spinner /></div>;
  if (!rows.length) return <EmptyState message={emptyMessage} />;
  return (
    <ul>
      {rows.map((r) => (
        <li
          key={r.id}
          onClick={() => onOpen(r)}
          className="flex cursor-pointer items-center gap-3 border-b border-line px-4 py-3 text-sm hover:bg-surface/60"
        >
          <span className="w-[150px] shrink-0 truncate">To: {r.recipient}</span>
          <StatusPill status={r.status} at={r.at} />
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium">{r.subject}</span>
            {r.body && <span className="text-muted"> - {r.body.replace(/\s+/g, ' ')}</span>}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleStar(r.id); }}
            className={starred.has(r.id) ? 'text-yellow-500' : 'text-gray-400 hover:text-gray-600'}
            aria-label="Star"
          >
            <StarIcon size={16} filled={starred.has(r.id)} />
          </button>
        </li>
      ))}
    </ul>
  );
}
