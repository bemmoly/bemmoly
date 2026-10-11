import { Logo } from '@bemmoly/ui';
import { useEffect, useRef } from 'react';

/** Which way each of the mark's four tiles starts out from centre, in the file's order. */
const FROM = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
] as const;

/** The mark is drawn 24 units tall with its tiles scaled by 0.06 inside; 4px apart, on screen. */
function offsetUnits(size: number): number {
  return 4 / ((size / 24) * 0.06);
}

/**
 * The finish line's one moment of delight: the mark's four tiles drift in from slightly apart
 * and settle into place, once, in about half a second. Only transform and opacity move, with an
 * ease-out and no overshoot; under reduced motion the mark is simply there.
 */
export function SettleMark({ size = 56 }: { size?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;
    const tiles = ref.current?.querySelectorAll('path');
    if (reduced || !tiles || typeof Element.prototype.animate !== 'function') return;
    const distance = offsetUnits(size);
    const animations = [...tiles].map((tile, index) => {
      const [x, y] = FROM[index % FROM.length] ?? [0, 0];
      return tile.animate(
        [
          { transform: `translate(${x * distance}px, ${y * distance}px) scale(0.92)`, opacity: 0 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: 420, delay: 80 + index * 70, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' },
      );
    });
    return () =>
      animations.forEach((animation) => {
        // Cancelling rejects `finished`; nothing waits on it, so the rejection is expected.
        animation.finished.catch(() => undefined);
        animation.cancel();
      });
  }, [size]);
  return (
    <span
      ref={ref}
      className="inline-flex [&_path]:[transform-box:fill-box] [&_path]:[transform-origin:center]"
    >
      <Logo size={size} label="" />
    </span>
  );
}
