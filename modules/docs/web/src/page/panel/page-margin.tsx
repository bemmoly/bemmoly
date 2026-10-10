import { useEffect, useRef, type RefObject } from 'react';
import { cx } from '../cx.ts';
import {
  FADE_WHILE_TYPING,
  marginShown,
  usePageChrome,
  usePageScreen,
  useSlotProps,
} from '../screen-context.ts';
import { MARGIN_SLOTS } from '../slots.ts';

const FOCUSABLE = '[data-thread],a[href],button:not([disabled]),input,[tabindex="0"]';

/** The margin's current view, if any shows on screen now. */
function useShownSlot(docked: boolean) {
  const margin = usePageChrome((state) => state.margin);
  const chosen = usePageChrome((state) => state.chosen);
  return MARGIN_SLOTS.find((slot) => marginShown({ margin, chosen }, slot.id, docked));
}

/** Moves focus into the margin when it was opened from a key or a menu. */
function useFocusOnRequest(ref: RefObject<HTMLElement | null>) {
  const focusRequest = usePageChrome((state) => state.focusRequest);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    // After the slot has rendered its first content.
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus());
  }, [focusRequest, ref]);
}

/**
 * The right margin docked beside the column, inside the page's scroll, so the outline can
 * stick and comment threads stay level with their passages. The page column moves left to
 * make room, so the margin never covers text. `float` hangs the bare outline off the
 * column's right edge, so the column stays centred on the page.
 */
export function DockedMargin({ float = false }: { float?: boolean }) {
  const slotProps = useSlotProps();
  const closeMargin = usePageChrome((state) => state.closeMargin);
  const ref = useRef<HTMLElement>(null);
  const slot = useShownSlot(true);
  useFocusOnRequest(ref);
  if (!slot) return null;
  const Body = slot.Component;
  return (
    <aside
      ref={ref}
      aria-label={slot.label}
      data-margin={slot.id}
      className={cx(
        'shrink-0',
        FADE_WHILE_TYPING,
        slot.bare
          ? float
            ? 'absolute inset-y-0 left-full w-48 pl-4'
            : 'w-56 self-start'
          : 'w-85 self-stretch border-l border-line bg-sunken motion-safe:animate-fade-in',
      )}
    >
      <Body {...slotProps} docked onClose={closeMargin} />
    </aside>
  );
}

/**
 * Below the docking width the margin opens over the page from the right, with a scrim that
 * closes it; Escape closes it too and hands focus back to the page.
 */
export function OverlayMargin() {
  const { docked } = usePageScreen();
  const slotProps = useSlotProps();
  const closeMargin = usePageChrome((state) => state.closeMargin);
  const ref = useRef<HTMLElement>(null);
  const slot = useShownSlot(docked);
  const open = !docked && Boolean(slot);
  useFocusOnRequest(ref);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) closeMargin();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, closeMargin]);

  if (!open || !slot) return null;
  const Body = slot.Component;
  return (
    <>
      <div
        aria-hidden
        onClick={closeMargin}
        className="absolute inset-0 z-20 bg-scrim motion-safe:animate-fade-in"
      />
      <aside
        ref={ref}
        aria-label={slot.label}
        data-margin={slot.id}
        className="absolute inset-y-0 right-0 z-30 flex w-full max-w-85 flex-col overflow-auto border-l border-line bg-canvas shadow-e3 motion-safe:animate-slide-in"
      >
        <Body {...slotProps} docked={false} onClose={closeMargin} />
      </aside>
    </>
  );
}
