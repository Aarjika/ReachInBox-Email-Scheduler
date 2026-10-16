import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

export function Button({ variant = 'primary', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }) {
  const styles =
    variant === 'primary'
      ? 'bg-brand text-white hover:bg-brand-dark'
      : 'border border-brand bg-white text-brand hover:bg-brand-soft';
  return <button className={`rounded-full px-5 py-2 text-sm font-medium disabled:opacity-50 ${styles} ${className}`} {...p} />;
}

export function Input({ label, ...p }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      <input className="w-full rounded-md bg-surface px-3 py-2" {...p} />
    </label>
  );
}

export function Spinner() {
  return <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-brand" />;
}

export function EmptyState({ message }: { message: string }) {
  return <div className="py-16 text-center text-sm text-muted">{message}</div>;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-xl text-gray-500">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed bottom-4 right-4 z-50 rounded-md px-4 py-3 text-sm text-white shadow-lg ${type === 'success' ? 'bg-brand' : 'bg-red-600'}`}>
      {message}
    </div>
  );
}

export function Avatar({ src, name, size = 32 }: { src?: string; name: string; size?: number }) {
  if (src) {
    return <img src={src} alt="" referrerPolicy="no-referrer" style={{ width: size, height: size }} className="shrink-0 rounded-full object-cover" />;
  }
  return (
    <div style={{ width: size, height: size }} className="flex shrink-0 items-center justify-center rounded-full bg-brand text-sm font-medium text-white">
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  );
}
