import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cx } from '../../lib/cx.ts';
import { animates } from '../../lib/presence.ts';
import { TIMING } from '../../tokens/interaction.ts';
import { MOTION_MS } from '../../tokens/motion.ts';
import { Toast, type ToastProps } from './toast.tsx';

export interface ToastOptions extends Omit<ToastProps, 'onDismiss' | 'className'> {
  /** Milliseconds before it leaves on its own; 0 keeps it until dismissed. Default 6000. */
  duration?: number;
}

export interface UndoOptions {
  /** What just happened: "Issue deleted". */
  title: ReactNode;
  body?: ReactNode;
  /** Puts it back. The toast leaves as soon as Undo is chosen. */
  onUndo: () => void;
}

interface ToastApi {
  show: (toast: ToastOptions) => string;
  /** A reversible action that already happened, with Undo for about six seconds. */
  undo: (options: UndoOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast needs a <ToastProvider> above it.');
  return api;
}

interface Clock {
  timer?: ReturnType<typeof setTimeout>;
  /** Time left when paused, or the full duration before it starts. */
  left: number;
  startedAt: number;
}

/**
 * Holds the toast stack, bottom right, newest last, 8px apart. A toast's countdown pauses
 * while the pointer is over it or focus is in it, Escape dismisses the focused toast, and
 * choosing its action dismisses it.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<(ToastOptions & { id: string; leaving?: boolean })[]>([]);
  const counter = useRef(0);
  const clocks = useRef(new Map<string, Clock>());

  /** Plays the exit where motion is allowed, then drops the toast from the stack. */
  const dismiss = useCallback((id: string) => {
    clearTimeout(clocks.current.get(id)?.timer);
    clocks.current.delete(id);
    const remove = () => setToasts((list) => list.filter((t) => t.id !== id));
    if (!animates()) {
      remove();
      return;
    }
    setToasts((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(remove, MOTION_MS.exit);
  }, []);

  const run = useCallback(
    (id: string) => {
      const clock = clocks.current.get(id);
      if (!clock) return;
      clearTimeout(clock.timer);
      clock.startedAt = Date.now();
      clock.timer = setTimeout(() => dismiss(id), clock.left);
    },
    [dismiss],
  );

  const pause = useCallback((id: string) => {
    const clock = clocks.current.get(id);
    if (!clock?.timer) return;
    clearTimeout(clock.timer);
    clock.timer = undefined;
    clock.left = Math.max(0, clock.left - (Date.now() - clock.startedAt));
  }, []);

  const show = useCallback(
    (toast: ToastOptions) => {
      counter.current += 1;
      const id = `toast-${counter.current}`;
      const action = toast.action && {
        ...toast.action,
        onClick: () => {
          toast.action?.onClick();
          dismiss(id);
        },
      };
      setToasts((list) => [...list, { ...toast, ...(action ? { action } : {}), id }]);
      const duration = toast.duration ?? TIMING.toastMs;
      if (duration > 0) {
        clocks.current.set(id, { left: duration, startedAt: Date.now() });
        run(id);
      }
      return id;
    },
    [dismiss, run],
  );

  const undo = useCallback(
    ({ title, body, onUndo }: UndoOptions) =>
      show({ title, ...(body ? { body } : {}), action: { label: 'Undo', onClick: onUndo } }),
    [show],
  );

  const api = useMemo(() => ({ show, undo, dismiss }), [show, undo, dismiss]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="fixed right-4 bottom-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            onPointerEnter={() => pause(toast.id)}
            onPointerLeave={() => run(toast.id)}
            onFocus={() => pause(toast.id)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) run(toast.id);
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Escape') return;
              event.stopPropagation();
              dismiss(toast.id);
            }}
          >
            <Toast
              title={toast.title}
              body={toast.body}
              {...(toast.tone ? { tone: toast.tone } : {})}
              {...(toast.action ? { action: toast.action } : {})}
              onDismiss={() => dismiss(toast.id)}
              className={cx(
                'motion-safe:animate-toast-in',
                toast.leaving && 'pointer-events-none motion-safe:animate-toast-out',
              )}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
