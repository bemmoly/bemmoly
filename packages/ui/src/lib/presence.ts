import { useEffect, useState } from 'react';
import { MOTION_MS, type MotionDuration } from '../tokens/motion.ts';

/** True where exit animations can run: a browser that allows motion. */
export function animates(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export interface Presence {
  /** Render the element: open, or still playing its exit. */
  mounted: boolean;
  /** Closing: the element carries its exit animation until it unmounts. */
  leaving: boolean;
}

/**
 * Keeps an overlay mounted for its exit animation after `open` turns false, then lets it go.
 * Without motion (reduced motion, or no browser) it unmounts at once, so nothing waits on an
 * animation that will not play.
 */
export function usePresence(open: boolean, exit: MotionDuration = 'base'): Presence {
  const [mounted, setMounted] = useState(open);
  // Adjusted while rendering, as React recommends for state that follows a prop.
  if (open && !mounted) setMounted(true);
  if (!open && mounted && !animates()) setMounted(false);

  useEffect(() => {
    if (open || !mounted) return undefined;
    const timer = setTimeout(() => setMounted(false), MOTION_MS[exit]);
    return () => clearTimeout(timer);
  }, [open, mounted, exit]);

  return { mounted: open || mounted, leaving: !open && mounted };
}
