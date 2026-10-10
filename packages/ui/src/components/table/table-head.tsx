import type { ReactNode } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';

export type SortDirection = 'asc' | 'desc';

export interface TableSort {
  key: string;
  direction: SortDirection;
}

export interface TableHeadColumn {
  key: string;
  header: ReactNode;
  align?: 'start' | 'center' | 'end';
  /** The header becomes a button that sorts by this column. */
  sortable?: boolean;
}

export const ALIGN = {
  start: 'text-left',
  center: 'justify-self-center text-center',
  end: 'justify-self-end text-right',
};

/** The quiet header row: 12px tertiary text in sentence case on a single line, 34px tall. */
export const HEAD_ROW = 'grid h-8.5 items-center gap-3 border-b border-line px-3 text-12 text-tx-3';

/** One column heading; a sortable one is a button carrying aria-sort's state as an arrow. */
export function TableHeading({
  column,
  sort,
  onSort,
}: {
  column: TableHeadColumn;
  sort?: TableSort | undefined;
  onSort?: ((sort: TableSort) => void) | undefined;
}) {
  const active = sort?.key === column.key;
  const ariaSort = active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined;
  const align = ALIGN[column.align ?? 'start'];
  if (!column.sortable || !onSort) {
    return (
      <span role="columnheader" className={cx('min-w-0 truncate font-medium', align)}>
        {column.header}
      </span>
    );
  }
  const next: TableSort = {
    key: column.key,
    direction: active && sort.direction === 'asc' ? 'desc' : 'asc',
  };
  return (
    <span role="columnheader" aria-sort={ariaSort} className={cx('min-w-0', align)}>
      <button
        type="button"
        onClick={() => onSort(next)}
        className={cx(
          'group -mx-1 inline-flex cursor-pointer items-center gap-1 rounded-xs border-0 bg-transparent px-1 font-sans text-12 font-medium',
          active ? 'text-tx-2' : 'text-tx-3 hover:text-tx-2',
          focusRing,
        )}
      >
        {column.header}
        <Icon
          name={active && sort.direction === 'desc' ? 'arrow-down' : 'arrow-up'}
          size={12}
          className={cx(
            'transition-opacity duration-base',
            active
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-60 group-focus-visible:opacity-60',
          )}
        />
      </button>
    </span>
  );
}
