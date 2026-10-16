import type { ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';

export interface StatTileProps {
  /** "Running", "Median lead time". */
  label: ReactNode;
  /** The figure, already formatted: "214", "3h 10m", "2.1%". */
  value: ReactNode;
  /** One quiet line under it: "of 358 slots", "down 12% on the 90 days before". */
  detail?: ReactNode;
  /** The detail's tone: better reads green, worse amber; neither is red. */
  detailTone?: 'default' | 'better' | 'worse';
  /** A small chart under the figure. */
  children?: ReactNode;
  className?: string;
}

const DETAIL = { default: 'text-tx-3', better: 'text-green-tx', worse: 'text-amber-tx' } as const;

/**
 * One headline number on a card: a label, the figure at 24px, a line of context and, when it
 * helps, a small chart. Capacity's strip and Insights' four measures are rows of these.
 */
export function StatTile({
  label,
  value,
  detail,
  detailTone = 'default',
  children,
  className,
}: StatTileProps) {
  return (
    <div
      className={cx(
        'flex min-w-0 flex-col gap-0.5 rounded-card border border-line bg-card px-3.5 py-3 shadow-e1',
        className,
      )}
    >
      <span className="truncate text-12 text-tx-2">{label}</span>
      <span className="text-24 leading-title font-semibold text-tx tabular-nums">{value}</span>
      {detail && <span className={cx('truncate text-12', DETAIL[detailTone])}>{detail}</span>}
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}
