import { useRef, useState } from 'react';
import { api } from '../api';
import type { Attachment, User } from '../types';
import {
  AlignCenterIcon, ArrowLeftIcon, BoldIcon, CalendarIcon, ChevronDownIcon, IndentIcon, ItalicIcon,
  ListIcon, ListOrderedIcon, OutdentIcon, PaperclipIcon, QuoteIcon, RedoIcon, StrikeIcon, UnderlineIcon, UndoIcon,
  UploadIcon, XIcon,
} from './icons';

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const MAX_CHIPS = 3;
const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB per file
const MAX_TOTAL_BYTES = 25 * 1024 * 1024; // 25 MB per email
const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.gif,.zip';

const fmtSize = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const toAttachment = (f: File) =>
  new Promise<Attachment>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ filename: f.name, contentType: f.type || 'application/octet-stream', data: String(reader.result).split(',')[1] ?? '' });
    reader.onerror = () => reject(new Error(`Could not read ${f.name}`));
    reader.readAsDataURL(f);
  });

const pad = (n: number) => String(n).padStart(2, '0');
const toLocalInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const tomorrowAt = (h: number) => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(h, 0, 0, 0); return toLocalInput(d); };
const QUICK = [
  { label: 'Tomorrow', value: tomorrowAt(9) },
  { label: 'Tomorrow, 10:00 AM', value: tomorrowAt(10) },
  { label: 'Tomorrow, 11:00 AM', value: tomorrowAt(11) },
  { label: 'Tomorrow, 3:00 PM', value: tomorrowAt(15) },
];

export function ComposePage({
  user, onClose, onDone,
}: {
  user: User;
  onClose: () => void;
  onDone: (msg: string, ok: boolean) => void;
}) {
  // ---- state: identical to the old ComposeModal ----
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('');
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(50);
  const [submitting, setSubmitting] = useState(false);
  // ---- UI-only state ----
  const [files, setFiles] = useState<File[]>([]);
  const [detected, setDetected] = useState<{ count: number; file: string } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftTime, setDraftTime] = useState('');
  const [toInput, setToInput] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const attachRef = useRef<HTMLInputElement>(null);

  const onFile = async (file?: File) => {
    if (!file) return;
    const matches = (await file.text()).match(EMAIL_RE) ?? [];
    const unique = [...new Set(matches.map((m) => m.toLowerCase()))];
    setRecipients(unique);
    setDetected({ count: unique.length, file: file.name });
  };

  const onAttach = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (next.length >= MAX_FILES) { onDone(`You can attach at most ${MAX_FILES} files`, false); break; }
      if (f.size === 0) { onDone(`${f.name} is empty`, false); continue; }
      if (f.size > MAX_FILE_BYTES) { onDone(`${f.name} is larger than 10 MB`, false); continue; }
      if (next.some((x) => x.name === f.name && x.size === f.size)) continue;
      next.push(f);
    }
    if (next.reduce((n, f) => n + f.size, 0) > MAX_TOTAL_BYTES) { onDone('Total attachments must be 25 MB or less', false); return; }
    setFiles(next);
  };

  const addTyped = () => {
    const found = toInput.match(EMAIL_RE) ?? [];
    if (found.length) setRecipients((r) => [...new Set([...r, ...found.map((m) => m.toLowerCase())])]);
    setToInput('');
  };

  const submit = async () => {
    if (!subject || !body || !recipients.length || !startTime) return onDone('Fill all fields and upload a leads file', false);
    setSubmitting(true);
    try {
      const attachments = await Promise.all(files.map(toAttachment));
      const r = await api.schedule({ subject, body, recipients, startTime: new Date(startTime).toISOString(), delaySeconds, hourlyLimit, attachments });
      onDone(`${r.scheduled} emails scheduled`, true);
      onClose();
    } catch (e) {
      onDone((e as Error).message, false);
    } finally {
      setSubmitting(false);
    }
  };

  const openPicker = () => { setDraftTime(startTime); setPickerOpen(true); };
  const syncBody = () => setBody(editorRef.current?.innerText.trim() ?? '');
  const exec = (cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    syncBody();
  };
  const tool = (icon: React.ReactNode, cmd: string, label: string, value?: string) => (
    <button key={label} type="button" aria-label={label} title={label}
      onMouseDown={(e) => { e.preventDefault(); exec(cmd, value); }}
      className="rounded p-1.5 text-gray-600 hover:bg-gray-100">
      {icon}
    </button>
  );
  const sep = (k: string) => <span key={k} className="mx-1 h-5 w-px bg-gray-200" />;

  return (
    <div className="min-h-screen bg-white">
      {/* top bar */}
      <div className="flex items-center gap-3 px-6 py-5">
        <button onClick={onClose} aria-label="Back" className="text-gray-700 hover:text-black"><ArrowLeftIcon size={22} /></button>
        <h1 className="flex-1 text-xl">Compose New Email</h1>
        {startTime && (
          <button onClick={openPicker} title="Change start time" className="text-xs text-gray-500 hover:text-gray-800">
            Starts {new Date(startTime).toLocaleString()}
          </button>
        )}
        <button type="button" onClick={() => attachRef.current?.click()} aria-label="Attach files" title="Attach files" className="relative text-brand">
          <PaperclipIcon size={20} />
          {files.length > 0 && <span className="absolute -bottom-2 -right-1 text-[10px] font-medium">{files.length}</span>}
        </button>
        <input ref={attachRef} type="file" multiple accept={ACCEPT} className="hidden"
          onChange={(e) => { onAttach(e.target.files); e.target.value = ''; }} />
        <div className="relative">
          <button
            onClick={startTime ? submit : openPicker}
            disabled={submitting}
            className="rounded-full border border-brand px-4 py-1 text-sm font-medium text-brand hover:bg-brand-soft disabled:opacity-50"
          >
            {submitting ? 'Scheduling…' : startTime ? 'Send' : 'Send Later'}
          </button>
          {pickerOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setPickerOpen(false)} />
              <div className="absolute right-0 top-full z-20 mt-3 w-[250px] rounded-xl bg-white p-4 text-sm shadow-xl ring-1 ring-black/5">
                <div className="mb-3 font-medium">Send Later</div>
                <div className="relative mb-3 border-b border-line pb-1">
                  <input type="datetime-local" value={draftTime} onChange={(e) => setDraftTime(e.target.value)}
                    className="w-full bg-transparent text-xs text-gray-600 outline-none" />
                  <CalendarIcon size={14} className="pointer-events-none absolute right-0 top-0 bg-white text-gray-400" />
                </div>
                <ul className="mb-4 space-y-1">
                  {QUICK.map((q) => (
                    <li key={q.label}>
                      <button onClick={() => setDraftTime(q.value)}
                        className={`w-full rounded px-1 py-1.5 text-left text-xs hover:bg-surface ${draftTime === q.value ? 'bg-brand-soft' : ''}`}>
                        {q.label}
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-end gap-3">
                  <button onClick={() => setPickerOpen(false)} className="text-xs">Cancel</button>
                  <button onClick={() => { if (draftTime) setStartTime(draftTime); setPickerOpen(false); }}
                    className="rounded-full border border-brand px-4 py-1 text-xs font-medium text-brand hover:bg-brand-soft">
                    Done
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* form */}
      <div className="mx-auto max-w-[810px] space-y-4 px-6 pb-10">
        <div className="flex items-center gap-4 text-xs">
          <span className="w-12">From</span>
          <span className="flex items-center gap-2 rounded-lg bg-surface px-3 py-1.5 text-sm">
            {user.email}<ChevronDownIcon size={14} className="text-gray-400" />
          </span>
        </div>

        <div className="flex items-center gap-4 border-b border-line pb-2 text-xs">
          <span className="w-12">To</span>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {recipients.slice(0, MAX_CHIPS).map((r) => (
              <span key={r} className="inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand-soft px-2.5 py-0.5 text-xs">
                {r}
                <button onClick={() => setRecipients((x) => x.filter((y) => y !== r))} aria-label={`Remove ${r}`}><XIcon size={10} /></button>
              </span>
            ))}
            {recipients.length > MAX_CHIPS && (
              <span className="rounded-full border border-brand/40 bg-brand-soft px-2.5 py-0.5 text-xs">+{recipients.length - MAX_CHIPS}</span>
            )}
            <input
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTyped(); } }}
              onBlur={addTyped}
              placeholder={recipients.length ? '' : 'recipient@example.com'}
              className="min-w-[140px] flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
            />
          </div>
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 text-sm text-brand">
            <UploadIcon size={14} /> Upload List
          </button>
          <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden"
            onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
        </div>

        {detected && (
          <p className={`-mt-2 pl-16 text-xs ${detected.count ? 'text-brand' : 'text-red-600'}`}>
            {detected.count
              ? `${detected.count} email ${detected.count === 1 ? 'address' : 'addresses'} detected in ${detected.file}`
              : `No email addresses found in ${detected.file}`}
          </p>
        )}

        <div className="flex items-center gap-4 border-b border-line pb-2 text-xs">
          <span className="w-12">Subject</span>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400" />
        </div>

        <div className="flex items-center gap-4 text-xs">
          <label className="flex items-center gap-3">
            Delay between 2 emails
            <input type="number" min={0} value={delaySeconds} placeholder="00" onChange={(e) => setDelaySeconds(Number(e.target.value))}
              className="w-14 rounded-lg bg-surface px-2.5 py-2 text-sm outline-none" />
          </label>
          <label className="flex items-center gap-3">
            Hourly Limit
            <input type="number" min={1} value={hourlyLimit} placeholder="00" onChange={(e) => setHourlyLimit(Number(e.target.value))}
              className="w-14 rounded-lg bg-surface px-2.5 py-2 text-sm outline-none" />
          </label>
        </div>

        {/* editor */}
        <div className="min-h-[370px] cursor-text rounded-xl bg-neutral-50 p-4" onClick={() => editorRef.current?.focus()}>
          <div className="relative">
            {!body && <span className="pointer-events-none absolute left-0 top-0 text-sm text-gray-400">Type Your Reply…</span>}
            <div ref={editorRef} contentEditable suppressContentEditableWarning onInput={syncBody}
              className="editor max-h-[40vh] min-h-[22px] overflow-y-auto text-sm" />
          </div>
          <div className="mt-3 flex w-fit max-w-full flex-wrap items-center rounded-full bg-white px-2 py-1 shadow-sm" onClick={(e) => e.stopPropagation()}>
            {tool(<UndoIcon size={16} />, 'undo', 'Undo')}
            {tool(<RedoIcon size={16} />, 'redo', 'Redo')}
            {sep('1')}
            {tool(<BoldIcon size={16} />, 'bold', 'Bold')}
            {tool(<ItalicIcon size={16} />, 'italic', 'Italic')}
            {tool(<UnderlineIcon size={16} />, 'underline', 'Underline')}
            {sep('2')}
            {tool(<AlignCenterIcon size={16} />, 'justifyCenter', 'Align center')}
            {sep('3')}
            {tool(<ListOrderedIcon size={16} />, 'insertOrderedList', 'Numbered list')}
            {tool(<ListIcon size={16} />, 'insertUnorderedList', 'Bulleted list')}
            {tool(<IndentIcon size={16} />, 'indent', 'Indent')}
            {tool(<OutdentIcon size={16} />, 'outdent', 'Outdent')}
            {tool(<QuoteIcon size={16} />, 'formatBlock', 'Quote', 'blockquote')}
            {sep('4')}
            {tool(<StrikeIcon size={16} />, 'strikeThrough', 'Strikethrough')}
          </div>
        </div>

        {files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {files.map((f) => (
              <span key={f.name + f.size} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs">
                <PaperclipIcon size={12} />
                {f.name}
                <span className="text-muted">{fmtSize(f.size)}</span>
                <button onClick={() => setFiles((x) => x.filter((y) => y !== f))} aria-label={`Remove ${f.name}`}><XIcon size={10} /></button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
