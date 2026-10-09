import { cx } from './cx.ts';

/*
 * The motion of the overlay surfaces, as class lists, so every dialog and sheet moves the same
 * way. Each pairs with usePresence: the element carries data-state="closed" while it plays its
 * exit, and ignores the pointer meanwhile. Everything is behind motion-safe:.
 */

/** Modal dialogs and the command palette: rise in over a fading scrim, sink back out. */
export const DIALOG_MOTION = cx(
  'motion-safe:animate-dialog-in backdrop:motion-safe:animate-fade-in',
  'data-[state=closed]:pointer-events-none data-[state=closed]:motion-safe:animate-dialog-out',
  'data-[state=closed]:backdrop:motion-safe:animate-fade-out',
);

/** The slide-over: in from the right edge, back out to it. */
export const SHEET_MOTION = cx(
  'motion-safe:animate-slide-in backdrop:motion-safe:animate-fade-in',
  'data-[state=closed]:pointer-events-none data-[state=closed]:motion-safe:animate-slide-out',
  'data-[state=closed]:backdrop:motion-safe:animate-fade-out',
);

/** A row or card that has just joined a list. */
export const ARRIVE_MOTION = 'motion-safe:animate-rise';
