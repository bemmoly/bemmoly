/**
 * Motion: the one set of durations, easings and keyframes every component and page animates
 * with. The mocks animate only the switch knob (.15s); everything else here is the polish pass's
 * addition, kept short so the product stays calm and fast. All of it runs behind motion-safe:,
 * and the base stylesheet stops it entirely under prefers-reduced-motion.
 */

/** Milliseconds, for code that waits on an animation (an exit before unmount). */
export const MOTION_MS = {
  /** Press feedback and colour flips. */
  instant: 90,
  /** Hover, focus and the switch knob: the mocks' .15s. */
  fast: 150,
  /** Popovers, menus, tooltips and list rows arriving. */
  base: 200,
  /** Dialogs, the slide-over, toasts and a dropped card settling. */
  slow: 260,
} as const;

export type MotionDuration = keyof typeof MOTION_MS;

/** The same durations as CSS values; they become --duration-<name>. */
export const MOTION = Object.fromEntries(
  Object.entries(MOTION_MS).map(([name, ms]) => [name, `${ms}ms`]),
) as Record<MotionDuration, string>;

/** Easings; they become --ease-<name> and Tailwind's ease-<name>. */
export const EASE = {
  /** Things that move within the page. */
  standard: 'cubic-bezier(.2,0,0,1)',
  /** Things arriving: fast out of the gate, a long soft landing. */
  out: 'cubic-bezier(.16,1,.3,1)',
  /** Things leaving: they accelerate away. */
  in: 'cubic-bezier(.4,0,1,1)',
  /** A dropped card: a hair of overshoot, then still. */
  settle: 'cubic-bezier(.34,1.36,.64,1)',
} as const;

/**
 * Keyframes by name, as CSS declarations per stop. Enter animations start from the `from` stop
 * and end on the element's own styles; exit animations end on the `to` stop and hold it.
 */
export const KEYFRAMES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'fade-in': { from: 'opacity: 0;' },
  'fade-out': { to: 'opacity: 0;' },
  /** Menus and the Select's list: from 4px towards the trigger, at 97%. */
  'pop-in': { from: 'opacity: 0; transform: translateY(var(--pop-from, -4px)) scale(0.97);' },
  'dialog-in': { from: 'opacity: 0; transform: translateY(8px) scale(0.98);' },
  'dialog-out': { to: 'opacity: 0; transform: translateY(4px) scale(0.985);' },
  /** The issue slide-over, in from the right edge. */
  'slide-in': { from: 'opacity: 0; transform: translateX(24px);' },
  'slide-out': { to: 'opacity: 0; transform: translateX(24px);' },
  'toast-in': { from: 'opacity: 0; transform: translateY(12px) scale(0.96);' },
  'toast-out': { to: 'opacity: 0; transform: translateX(24px);' },
  /** A row or card that has just been added to a list. */
  rise: { from: 'opacity: 0; transform: translateY(4px);' },
  /** A card or row that has just been dropped: lifted a hair, then set down. */
  settle: {
    from: 'transform: translateY(-2px) scale(1.02); box-shadow: var(--shadow-menu);',
    to: 'transform: none;',
  },
};

/** Tailwind's animate-<name> utilities: keyframe, duration, easing and fill. */
export const ANIMATIONS = {
  'fade-in': 'fade-in var(--duration-base) var(--ease-out) both',
  'fade-out': 'fade-out var(--duration-base) var(--ease-in) forwards',
  'pop-in': 'pop-in var(--duration-base) var(--ease-out) both',
  'dialog-in': 'dialog-in var(--duration-slow) var(--ease-out) both',
  'dialog-out': 'dialog-out var(--duration-base) var(--ease-in) forwards',
  'slide-in': 'slide-in var(--duration-slow) var(--ease-out) both',
  'slide-out': 'slide-out var(--duration-base) var(--ease-in) forwards',
  'toast-in': 'toast-in var(--duration-slow) var(--ease-out) both',
  'toast-out': 'toast-out var(--duration-base) var(--ease-in) forwards',
  rise: 'rise var(--duration-base) var(--ease-out) both',
  settle: 'settle var(--duration-slow) var(--ease-settle) both',
} as const;
