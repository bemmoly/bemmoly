import type { ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';
import { Skeleton } from '../skeleton/skeleton.tsx';

export interface TableSkeletonColumn {
  /** The same CSS grid track as the real column. */
  width: string;
  /** What stands in for a cell; a bar in a 13px line box by default. */
  cell?: ReactNode;
  align?: 'start' | 'center' | 'end';
}

export interface TableSkeletonProps {
  /** Names the loading region, e.g. "Loading projects". */
  label: string;
  columns: readonly TableSkeletonColumn[];
  rows?: number;
  density?: 'md' | 'sm';
  className?: string;
}

const ALIGN = {
  start: 'justify-self-start',
  center: 'justify-self-center',
  end: 'justify-self-end',
};
const BARS = ['72%', '54%', '64%', '46%', '58%'];

/** A bar in a line box of the table's 13px text, so the row is as tall as a loaded one. */
export function TableSkeletonLine({ width = '60%' }: { width?: string | number }) {
  return (
    <span className="flex h-[1lh] w-full items-center text-13">
      <Skeleton width={width} height={9} />
    </span>
  );
}

/**
 * The Table while its rows load: the same card, header bar and row tracks, with bars in place
 * of the headings and cells, so the loaded table replaces it without a shift.
 */
export function TableSkeleton({
  label,
  columns,
  rows = 4,
  density = 'md',
  className,
}: TableSkeletonProps) {
  const template = { gridTemplateColumns: columns.map((c) => c.width).join(' ') };
  const rowPad = density === 'md' ? 'py-2.5' : 'py-2.25';
  return (
    <div
      role="status"
      aria-label={label}
      aria-busy
      className={cx('overflow-hidden rounded-card border border-br bg-sf', className)}
    >
      <div
        style={template}
        className="grid items-end gap-3 border-b border-br2 bg-sf2 px-4 py-2.25 text-11"
      >
        {columns.map((column, index) => (
          <span
            key={index}
            className={cx('flex h-[1lh] items-center', ALIGN[column.align ?? 'start'])}
          >
            {index < columns.length - 1 && <Skeleton width={48} height={8} />}
          </span>
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div
          key={row}
          style={template}
          className={cx('grid items-center gap-3 border-b border-br-row px-4', rowPad)}
        >
          {columns.map((column, index) => (
            <div key={index} className={cx('flex min-w-0', ALIGN[column.align ?? 'start'])}>
              {column.cell ?? <TableSkeletonLine width={BARS[(row + index) % BARS.length]} />}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
