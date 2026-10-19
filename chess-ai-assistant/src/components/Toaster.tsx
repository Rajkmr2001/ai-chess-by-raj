import { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cx } from './ui';

export interface ToastItem {
  id: number;
  kind: 'info' | 'error' | 'success';
  text: string;
}

const STYLES = {
  info: {
    wrapper:
      'border-slate-300 bg-white text-slate-800 dark:border-white/15 dark:bg-slate-800 dark:text-slate-100',
    icon: <Info className="h-4 w-4 text-sky-500" />,
  },
  success: {
    wrapper:
      'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-950 dark:text-emerald-100',
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  },
  error: {
    wrapper:
      'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-400/30 dark:bg-rose-950 dark:text-rose-100',
    icon: <AlertCircle className="h-4 w-4 text-rose-500" />,
  },
} as const;

function ToastRow({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), 6000);
    return () => window.clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const style = STYLES[toast.kind];
  return (
    <div
      role={toast.kind === 'error' ? 'alert' : 'status'}
      className={cx(
        'slide-up pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-xl border px-3 py-2.5 text-xs leading-relaxed shadow-lg',
        style.wrapper,
      )}
    >
      <span className="mt-0.5 shrink-0">{style.icon}</span>
      <span className="min-w-0 flex-1">{toast.text}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function Toaster({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  if (!toasts.length) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-3 z-40 flex flex-col items-center gap-2 px-3 sm:bottom-5 sm:left-auto sm:right-5 sm:items-end"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastRow key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
