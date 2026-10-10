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
import { TIMING } from '../../tokens/interaction.ts';
import { Kbd } from '../kbd/kbd.tsx';

export interface TooltipProps {
  /** What the control does, in a few words: "New issue". */
  label: ReactNode;
  /** Its shortcut, drawn as keys: "C", "Mod+K". */
  keys?: string;
  /** One focusable element; it gets aria-describedby while the tip shows. */
  children: ReactElement<Record<string, unknown>>;
  side?: 'top' | 'bottom';
  /** Milliseconds of hover before it opens; focus opens it at once. */
  delay?: number;
}

/**
 * When the last tooltip closed. Moving from one control to the next within the skip window
 * opens the next tip at once, so scanning a toolbar is not a series of waits.
 */
let lastClosedAt = -Infinity;

const recently = () => performance.now() - lastClosedAt < TIMING.tooltipSkipMs;

/**
 * A short label for a control, with its shortcut. It opens after a hover delay, at once on
 * keyboard focus or when another tooltip has just closed, and closes on Escape, blur or
 * pointer leave. It never holds the only copy of information (docs/design/premium/interaction.md).
 */
export function Tooltip({
  label,
  keys,
  children,
  side = 'top',
  delay = TIMING.tooltipDelayMs,
}: TooltipProps) {
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
    if (now || recently()) setOpen(true);
    else timer.current = setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    clearTimeout(timer.current);
    if (open) lastClosedAt = performance.now();
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
            'pointer-events-none absolute left-1/2 z-50 inline-flex -translate-x-1/2 items-center gap-2 rounded-control bg-tx px-2 py-1 text-12 font-medium whitespace-nowrap text-canvas shadow-e2 motion-safe:animate-fade-in',
            side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
          )}
        >
          {label}
          {keys && (
            <Kbd
              keys={keys}
              className="border-transparent bg-[color-mix(in_oklab,var(--canvas)_16%,transparent)] text-canvas"
            />
          )}
        </span>
      )}
    </span>
  );
}
