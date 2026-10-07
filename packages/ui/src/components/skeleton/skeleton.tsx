import type { CSSProperties } from 'react';
import { cx } from '../../lib/cx.ts';

export interface SkeletonProps {
  /** CSS width, e.g. 120 or "40%". */
  width?: CSSProperties['width'];
  /** CSS height; defaults to one 13px line. */
  height?: CSSProperties['height'];
  shape?: 'line' | 'circle' | 'block';
  className?: string;
}

const SHAPES = { line: 'rounded-tick', circle: 'rounded-full', block: 'rounded-panel' } as const;

/**
 * Placeholder bars on the trk colour, the bars of the Board Settings live preview. They pulse
 * only when motion is allowed. Mark the loading region aria-busy; skeletons are hidden from
 * assistive tech.
 */
export function Skeleton({
  width = '100%',
  height = 13,
  shape = 'line',
  className,
}: SkeletonProps) {
  return (
    <span
      aria-hidden
      className={cx('block shrink-0 bg-trk motion-safe:animate-pulse', SHAPES[shape], className)}
      style={{ width, height }}
    />
  );
}

const WIDTHS = ['92%', '78%', '85%', '64%', '88%', '70%'];

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <span aria-hidden className={cx('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '48%' : WIDTHS[i % WIDTHS.length]} />
      ))}
    </span>
  );
}
