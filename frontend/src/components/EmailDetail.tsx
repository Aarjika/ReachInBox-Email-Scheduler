import type { User } from '../types';
import { ArrowLeftIcon, PaperclipIcon, StarIcon } from './icons';
import { Avatar } from './ui';
import { StatusPill, type ListRow } from './EmailList';

const fmtSize = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function EmailDetail({
  row, user, starred, onToggleStar, onBack,
}: {
  row: ListRow;
  user: User;
  starred: boolean;
  onToggleStar: () => void;
  onBack: () => void;
}) {
  return (
    <div className="min-h-screen bg-white">
      <div className="flex items-center gap-4 px-6 py-5">
        <button onClick={onBack} aria-label="Back" className="text-gray-700 hover:text-black"><ArrowLeftIcon size={22} /></button>
        <h1 className="flex-1 truncate text-xl font-medium">{row.subject}</h1>
        <button onClick={onToggleStar} className={starred ? 'text-yellow-500' : 'text-gray-400 hover:text-gray-600'} aria-label="Star">
          <StarIcon size={18} filled={starred} />
        </button>
        <Avatar src={user.avatar} name={user.name} size={32} />
      </div>

      <div className="mx-auto max-w-[800px] px-6 pt-4">
        <div className="flex items-start gap-3">
          <Avatar name={row.recipient} size={40} />
          <div className="min-w-0 flex-1 leading-snug">
            <div className="text-sm"><span className="font-semibold">{user.name}</span> <span className="text-gray-500">&lt;{user.email}&gt;</span></div>
            <div className="text-xs text-gray-500">to {row.recipient}</div>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <StatusPill status={row.status} at={row.at} />
            {new Date(row.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </div>
        </div>

        <div className="mt-6 whitespace-pre-wrap pl-[52px] text-sm leading-relaxed">
          {row.body ?? <span className="text-muted">(No message body.)</span>}
        </div>

        {row.attachments && row.attachments.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2 pl-[52px]">
            {row.attachments.map((a, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs">
                <PaperclipIcon size={12} />
                {a.filename}
                <span className="text-muted">{fmtSize(a.size)}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
