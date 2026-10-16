import { cx } from '../../lib/cx.ts';
import { Badge, type BadgeTone } from '../badge/badge.tsx';
import { Lane, type LaneDot } from '../lane/lane.tsx';

/** A short note on a cell: "1 failed" (danger), "1 waiting" (warn), "train 11:00" (accent). */
export interface DeployCellFlag {
  tone: 'danger' | 'warn' | 'accent';
  text: string;
}

export interface DeployCellProps {
  /** Already formatted: "212", or "41 running" in the build column. */
  count: string;
  /** Quiet words after the count: "3 moving", "1 canary". */
  secondary?: string | null;
  /** Releases moving through the cell; a calm cell has none. */
  dots: readonly LaneDot[];
  /** At most two are drawn; the label carries all of them. */
  flags?: readonly DeployCellFlag[];
  /** The whole cell for assistive tech: "Staging: 210 applications, 2 moving, 1 failed". */
  label: string;
  /** Rewinding: dots hold still and the lane reads as history. */
  still?: boolean;
  className?: string;
}

const TONE: Record<DeployCellFlag['tone'], BadgeTone> = {
  danger: 'danger',
  warn: 'warn',
  accent: 'accent',
};

/**
 * One Release map cell: the lane of moving releases over the count. Presentational and
 * effect-free, so a map of hundreds of cells costs a few elements each; the grid owns focus,
 * clicks and the cell's accessible name (the visible parts are hidden behind `label`).
 */
export function DeployCell({
  count,
  secondary,
  dots,
  flags = [],
  label,
  still = false,
  className,
}: DeployCellProps) {
  return (
    <div className={cx('flex min-w-0 flex-col justify-center gap-1.25', className)}>
      <span className="sr-only">{label}</span>
      <Lane dots={dots} still={still} />
      <div
        aria-hidden
        className="flex min-w-0 items-center gap-1.5 overflow-hidden text-11 whitespace-nowrap"
      >
        <span className="font-medium text-tx-2 tabular-nums">{count}</span>
        {secondary ? <span className="truncate text-tx-3">{secondary}</span> : null}
        {flags.slice(0, 2).map((flag) => (
          <Badge key={`${flag.tone}:${flag.text}`} tone={TONE[flag.tone]}>
            {flag.text}
          </Badge>
        ))}
      </div>
    </div>
  );
}
