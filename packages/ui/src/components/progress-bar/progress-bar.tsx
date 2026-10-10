import { cx } from '../../lib/cx.ts';

export type ProgressSize = 'xs' | 'sm' | 'md';

/**
 * Track heights from the mocks: 4px with a 2px radius (subtask progress on the Issue page and
 * drawer), 5px with 3px (swimlane headers, the epic panel) and 6px with 3px (the Board's
 * velocity tile). The track is always trk.
 */
const SIZES: Record<ProgressSize, string> = {
  xs: 'h-1 rounded-tick',
  sm: 'h-1.25 rounded-chip',
  md: 'h-1.5 rounded-chip',
};

export interface ProgressBarProps {
  /** Percent complete, clamped to 0..100. */
  value: number;
  size?: ProgressSize;
  /** Fill colour as a background utility; the mocks use ok, the accent and epic hues. */
  fillClassName?: string;
  /** Names the bar for assistive tech, e.g. "Sprint progress". */
  label: string;
  /** Width utilities such as w-30 or flex-1; the bar is block-level otherwise. */
  className?: string;
}

export function ProgressBar({
  value,
  size = 'sm',
  fillClassName = 'bg-green',
  label,
  className,
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <span
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cx('block shrink-0 overflow-hidden bg-line', SIZES[size], className)}
    >
      <span className={cx('block h-full', fillClassName)} style={{ width: `${pct}%` }} />
    </span>
  );
}
