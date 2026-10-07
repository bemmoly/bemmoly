import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { cx } from '../../lib/cx.ts';

export interface TooltipProps {
  content: ReactNode;
  /** One focusable element; it gets aria-describedby while the tip shows. */
  children: ReactElement<Record<string, unknown>>;
  side?: 'top' | 'bottom';
  /** Milliseconds before showing on hover; focus shows at once. */
  delay?: number;
}

/**
 * The mocks use native title attributes for hints; this is the styled equivalent for keyboard
 * and touch users: inverted (tx on sf), 11.5px medium, 4px 8px, 5px radius.
 */
export function Tooltip({ content, children, side = 'top', delay = 300 }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const id = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const show = (now: boolean) => {
    clearTimeout(timer.current);
    if (now) setOpen(true);
    else timer.current = setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    clearTimeout(timer.current);
    setOpen(false);
  };

  return (
    <span
      className="relative inline-flex"
      onPointerEnter={() => show(false)}
      onPointerLeave={hide}
      onFocus={() => show(true)}
      onBlur={hide}
    >
      {cloneElement(children, { 'aria-describedby': open ? id : undefined })}
      {open && (
        <span
          role="tooltip"
          id={id}
          className={cx(
            'pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 rounded-sm bg-tx px-2 py-1 text-11h font-medium whitespace-nowrap text-sf shadow-menu',
            side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
