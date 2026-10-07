import { create } from 'zustand';

/** PLACEHOLDER for @bemmoly/ui Toast: short confirmations in the bottom-left corner. */
export type ToastTone = 'ok' | 'danger' | 'neutral';

interface ToastEntry {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastState {
  toasts: ToastEntry[];
  push(message: string, tone: ToastTone): void;
  dismiss(id: number): void;
}

let nextId = 1;

const useToasts = create<ToastState>()((set) => ({
  toasts: [],
  push: (message, tone) => {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts, { id, message, tone }] }));
    setTimeout(() => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })), 4000);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export function toast(message: string, tone: ToastTone = 'ok'): void {
  useToasts.getState().push(message, tone);
}

const DOT: Record<ToastTone, string> = { ok: 'bg-ok', danger: 'bg-danger', neutral: 'bg-tx5' };

export function Toaster() {
  const toasts = useToasts((state) => state.toasts);
  const dismiss = useToasts((state) => state.dismiss);
  return (
    <div aria-live="polite" className="fixed bottom-5 left-5 z-60 flex flex-col gap-2">
      {toasts.map((entry) => (
        <div
          key={entry.id}
          role={entry.tone === 'danger' ? 'alert' : 'status'}
          className="flex max-w-105 items-center gap-2.5 rounded-card bg-sf px-3.5 py-2.5 text-small text-tx shadow-menu"
        >
          <span className={`size-1.75 shrink-0 rounded-full ${DOT[entry.tone]}`} />
          <span className="flex-1">{entry.message}</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => dismiss(entry.id)}
            className="cursor-pointer border-0 bg-transparent p-0 text-tx5"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
