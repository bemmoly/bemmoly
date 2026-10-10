import {
  cloneElement,
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { layerFor } from '../../lib/floating.tsx';
import { TIMING } from '../../tokens/interaction.ts';
import { Kbd } from '../kbd/kbd.tsx';

export interface TooltipProps {
  /** What the control does, in a few words: "New issue". */
  label: ReactNode;
  /** Its shortcut, drawn as keys: "C", "Mod+K". */
  keys?: string;
  /** One focusable element; it gets aria-describedby while the tip shows. */
  children: ReactElement<Record<string, unknown>>;
  /** right: beside a control on the collapsed sidebar rail. */
  side?: 'top' | 'bottom' | 'right';
  /** Milliseconds of hover before it opens; focus opens it at once. */
  delay?: number;
}

/**
 * When the last tooltip closed. Moving from one control to the next within the skip window
 * opens the next tip at once, so scanning a toolbar is not a series of waits.
 */
let lastClosedAt = -Infinity;

const recently = () => performance.now() - lastClosedAt < TIMING.tooltipSkipMs;

const GAP = 6;

interface TipProps extends Pick<TooltipProps, 'label' | 'keys'> {
  anchor: HTMLElement;
  side: NonNullable<TooltipProps['side']>;
  id: string;
}

/**
 * The tip itself, portalled beside its trigger so a scrolling sidebar or a clipped toolbar
 * never cuts it off, and kept inside the viewport.
 */
function Tip({ anchor, side, id, label, keys }: TipProps) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const tip = ref.current;
    if (!tip) return;
    // The wrapper is display: contents (no box of its own), so the control is what it points at.
    const box = (anchor.firstElementChild ?? anchor).getBoundingClientRect();
    const own = tip.getBoundingClientRect();
    const view = anchor.ownerDocument.documentElement.clientWidth || window.innerWidth;
    let top: number;
    let left: number;
    if (side === 'right') {
      top = box.top + box.height / 2 - own.height / 2;
      left = box.right + GAP;
    } else {
      top = side === 'top' ? box.top - GAP - own.height : box.bottom + GAP;
      left = box.left + box.width / 2 - own.width / 2;
    }
    tip.style.top = `${Math.max(4, top)}px`;
    tip.style.left = `${Math.max(4, Math.min(left, view - own.width - 4))}px`;
    tip.style.visibility = 'visible';
  }, [anchor, side]);
  return createPortal(
    <span
      ref={ref}
      role="tooltip"
      id={id}
      style={{ visibility: 'hidden' }}
      className="pointer-events-none fixed top-0 left-0 z-50 inline-flex items-center gap-2 rounded-control bg-tx px-2 py-1 text-12 font-medium whitespace-nowrap text-canvas shadow-e2 motion-safe:animate-fade-in"
    >
      {label}
      {keys && (
        <Kbd
          keys={keys}
          className="border-transparent bg-[color-mix(in_oklab,var(--canvas)_16%,transparent)] text-canvas"
        />
      )}
    </span>,
    layerFor(anchor),
  );
}

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
  const [anchor, setAnchor] = useState<HTMLSpanElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pressed = useRef(false);
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

  // display: contents keeps the wrapper out of layout, so the control stays the flex or grid
  // item its own classes place, and a disabled control still reports the pointer to it.
  return (
    <span
      ref={setAnchor}
      className="contents"
      onPointerEnter={() => show(false)}
      onPointerLeave={hide}
      onPointerDown={() => {
        pressed.current = true;
        hide();
      }}
      onFocus={() => {
        // Keyboard focus opens it at once; a click's focus does not cover the menu it opens.
        if (!pressed.current) show(true);
      }}
      onBlur={() => {
        pressed.current = false;
        hide();
      }}
    >
      {cloneElement(children, { 'aria-describedby': open ? id : undefined })}
      {open && anchor && <Tip anchor={anchor} side={side} id={id} label={label} keys={keys} />}
    </span>
  );
}
