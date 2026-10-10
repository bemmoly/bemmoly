import type { PageCover } from '@bemmoly/module-docs/shared';
import { pageIconTintClass, type PageIconTint } from '@bemmoly/ui/icons';
import type { ReactNode } from 'react';
import { cx } from '../cx.ts';

/*
 * The drawn covers: shapes from the logo (rounded tiles, the circle) in one tint, on the
 * sunken surface, so a cover reads as Bemmoly in light and dark alike and never competes
 * with the title. Colour comes from currentColor, set by the tint class on the svg.
 */

const W = 1200;
const H = 148;

const tile = (x: number, y: number, size: number, opacity: number, round = 0.24) => (
  <rect
    key={`${x}:${y}`}
    x={x}
    y={y}
    width={size}
    height={size}
    rx={size * round}
    fill="currentColor"
    opacity={opacity}
  />
);

const PATTERNS: Record<PageCover, () => ReactNode> = {
  tiles: () => [
    tile(720, -40, 150, 0.3),
    tile(885, -40, 150, 0.16),
    tile(720, 125, 150, 0.12),
    tile(885, 125, 150, 0.16, 0.5),
    tile(1050, -40, 150, 0.08),
    tile(555, 44, 150, 0.06),
  ],
  steps: () =>
    [0, 1, 2, 3, 4, 5].map((index) =>
      tile(560 + index * 110, 96 - index * 26, 96, 0.06 + index * 0.05),
    ),
  orbit: () =>
    [70, 120, 170, 220].map((r, index) => (
      <circle
        key={r}
        cx={980}
        cy={74}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={18 - index * 3}
        opacity={0.28 - index * 0.06}
      />
    )),
  grid: () =>
    Array.from({ length: 4 }, (_, row) =>
      Array.from({ length: 12 }, (_, col) =>
        tile(560 + col * 54, 4 + row * 36, 28, ((col + row) % 5) * 0.06 + 0.06),
      ),
    ).flat(),
  dots: () =>
    Array.from({ length: 6 }, (_, row) =>
      Array.from({ length: 30 }, (_, col) => (
        <circle
          key={`${row}:${col}`}
          cx={20 + col * 40 + (row % 2) * 20}
          cy={14 + row * 24}
          r={4}
          fill="currentColor"
          opacity={Math.min(0.4, (col / 30) * 0.45)}
        />
      )),
    ).flat(),
  bands: () =>
    [0, 1, 2, 3, 4].map((index) => (
      <rect
        key={index}
        x={640 + index * 120}
        y={-120}
        width={64}
        height={400}
        rx={32}
        fill="currentColor"
        opacity={0.08 + index * 0.05}
        transform={`rotate(32 ${672 + index * 120} 74)`}
      />
    )),
};

export const COVER_NAMES: Record<PageCover, string> = {
  tiles: 'Tiles',
  steps: 'Steps',
  orbit: 'Orbit',
  grid: 'Grid',
  dots: 'Dots',
  bands: 'Bands',
};

export interface CoverArtProps {
  cover: PageCover;
  /** The page icon's tint; the Docs colour without one. */
  tint?: PageIconTint | null;
  className?: string;
}

/** One drawn cover, filling its box and cropped from the left so the shapes stay right. */
export function CoverArt({ cover, tint, className }: CoverArtProps) {
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMaxYMid slice"
      className={cx(
        'absolute inset-0 size-full bg-sunken',
        tint ? pageIconTintClass(tint) : 'text-brand-2',
        className,
      )}
    >
      {PATTERNS[cover]()}
    </svg>
  );
}
