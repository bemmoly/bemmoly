import {
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';
import { createPortal } from 'react-dom';
import { cx } from './cx.ts';

export type FloatingAlign = 'start' | 'end';
export type FloatingSide = 'bottom' | 'top';

/** 4px between trigger and popover (the menu's mt-1); 8px kept clear of the viewport edge. */
const GAP = 4;
const MARGIN = 8;

export interface Placement {
  top: number;
  left: number;
  maxHeight: number;
  side: FloatingSide;
}

interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * Where a popover goes: under its anchor, or above it when there is less room below than its
 * height and more room above. Aligned to the anchor's start or end edge and kept inside the
 * viewport.
 */
export function placeFloating(
  anchor: Box,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  align: FloatingAlign = 'start',
): Placement {
  const below = viewport.height - anchor.bottom - GAP - MARGIN;
  const above = anchor.top - GAP - MARGIN;
  const side: FloatingSide = size.height <= below || below >= above ? 'bottom' : 'top';
  const maxHeight = Math.max(0, side === 'bottom' ? below : above);
  const height = Math.min(size.height, maxHeight);
  const top = side === 'bottom' ? anchor.bottom + GAP : anchor.top - GAP - height;
  const wanted = align === 'end' ? anchor.right - size.width : anchor.left;
  const left = Math.max(MARGIN, Math.min(wanted, viewport.width - size.width - MARGIN));
  return { top, left, maxHeight, side };
}

/**
 * The element a popover is portalled into. A modal <dialog> makes everything outside it inert,
 * so a popover opened from inside one must stay a descendant of that dialog.
 */
export function layerFor(anchor: Element): HTMLElement {
  return anchor.closest('dialog') ?? anchor.ownerDocument.body;
}

export interface FloatingLayerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'popover'> {
  /** The trigger the popover hangs from; nothing renders until it is mounted. */
  anchor: HTMLElement | null;
  align?: FloatingAlign;
  /** Match the anchor's width, never narrower than this many px (the Select's popover). */
  matchWidth?: number;
  /** Padding and overflow are the caller's: the menu scrolls itself, the Select its list. */
  className?: string;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

/** The popover API puts the layer in the top layer; without it a fixed z-50 layer stands in. */
const POPOVER = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;

/**
 * A popover surface portalled out of its trigger's container, so overflow-hidden cards, tables
 * and drawers never clip it. Where the browser has the popover API it is shown in the top
 * layer, above dialogs and every stacking context; otherwise it is a fixed, z-50 layer.
 * Position follows the anchor on scroll and resize.
 */
export function FloatingLayer({
  anchor,
  align = 'start',
  matchWidth,
  className,
  children,
  ref,
  ...rest
}: FloatingLayerProps) {
  const floatingRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => floatingRef.current as HTMLDivElement);

  useLayoutEffect(() => {
    const el = floatingRef.current;
    if (!anchor || !el) return undefined;
    if (POPOVER && !el.matches(':popover-open')) el.showPopover();
    const place = () => {
      const box = anchor.getBoundingClientRect();
      if (matchWidth !== undefined) el.style.width = `${Math.max(box.width, matchWidth)}px`;
      el.style.maxHeight = '';
      const rect = el.getBoundingClientRect();
      const view = anchor.ownerDocument.documentElement;
      const at = placeFloating(
        box,
        { width: rect.width, height: rect.height },
        { width: view.clientWidth || window.innerWidth, height: window.innerHeight },
        align,
      );
      el.style.top = `${at.top}px`;
      el.style.left = `${at.left}px`;
      el.style.maxHeight = `${at.maxHeight}px`;
      el.dataset['side'] = at.side;
    };
    place();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(place) : null;
    observer?.observe(el);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor, align, matchWidth]);

  if (!anchor) return null;
  return createPortal(
    <div
      ref={floatingRef}
      popover={POPOVER ? 'manual' : undefined}
      {...rest}
      className={cx(
        'fixed inset-auto z-50 m-0 flex flex-col rounded-card border border-br bg-sf text-13 text-tx shadow-menu',
        className,
      )}
    >
      {children}
    </div>,
    layerFor(anchor),
  );
}
