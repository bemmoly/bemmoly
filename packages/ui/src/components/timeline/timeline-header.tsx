import { cx } from '../../lib/cx.ts';
import { timelineTicks, type TimelineScale } from './scale.ts';

/*
 * The roadmap's date header and the lines under it. The header is two 24px tiers (months over
 * weeks, or quarters over months) with today's chip on the accent; the grid is one layer
 * behind every row, so a hundred rows draw their week lines once.
 */

export interface TimelineHeaderProps {
  scale: TimelineScale;
  /** Today's day number; its chip shows when today is on the axis. */
  today: number;
  className?: string;
}

export function TimelineHeader({ scale, today, className }: TimelineHeaderProps) {
  const { major, minor } = timelineTicks(scale);
  const onAxis = today >= scale.from && today <= scale.to;
  return (
    <div
      className={cx('relative h-12 shrink-0 bg-canvas text-12', className)}
      style={{ width: scale.width }}
    >
      <ol aria-label="Dates" className="m-0 flex h-6 list-none border-b border-line-2 p-0">
        {major.map((tick) => (
          <li
            key={tick.day}
            title={tick.title}
            className="shrink-0 truncate border-r border-line-2 px-2 leading-6 font-semibold text-tx"
            style={{ width: tick.width }}
          >
            {tick.width >= 48 ? tick.label : ''}
          </li>
        ))}
      </ol>
      <ol aria-hidden className="m-0 flex h-6 list-none p-0">
        {minor.map((tick) => (
          <li
            key={tick.day}
            className="shrink-0 truncate border-r border-line-2 text-center leading-6 text-tx-3 tabular-nums"
            style={{ width: tick.width }}
          >
            {tick.width >= 18 ? tick.label : ''}
          </li>
        ))}
      </ol>
      {onAxis && (
        <span
          className="absolute top-6.5 z-1 -translate-x-1/2 rounded-chip bg-acc-fill px-1.5 text-11 leading-4.5 font-semibold text-on-acc"
          style={{ left: scale.x(today) + scale.dayWidth / 2 }}
        >
          Today
        </span>
      )}
    </div>
  );
}

export interface TimelineGridProps {
  scale: TimelineScale;
  today: number;
  className?: string;
}

/** The week (or month) lines and today's line, behind the rows; decorative. */
export function TimelineGrid({ scale, today, className }: TimelineGridProps) {
  const { minor } = timelineTicks(scale);
  const onAxis = today >= scale.from && today <= scale.to;
  return (
    <div aria-hidden className={cx('pointer-events-none absolute inset-y-0', className)}>
      {minor.map((tick) => (
        <span
          key={tick.day}
          className="absolute inset-y-0 w-px bg-line-2"
          style={{ left: tick.x + tick.width - 1 }}
        />
      ))}
      {onAxis && (
        <span
          className="absolute inset-y-0 w-px bg-acc"
          style={{ left: scale.x(today) + scale.dayWidth / 2 }}
        />
      )}
    </div>
  );
}
