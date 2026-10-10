import { useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';
import { focusRingInset } from '../../lib/focus.ts';
import { Button } from '../button/button.tsx';

export interface TableColumn<T> {
  key: string;
  header: ReactNode;
  /** A CSS grid track, as in the mocks: "minmax(0,1.4fr)", "150px", "28px". */
  width: string;
  align?: 'start' | 'center' | 'end';
  render: (row: T) => ReactNode;
  /** Dropped below 640px so a phone keeps the columns that identify the row. */
  hideOnPhone?: boolean;
  /**
   * Secondary actions (a row's ··· menu): shown on row hover and keyboard focus, always on
   * touch screens, so nothing is hidden from anyone.
   */
  reveal?: boolean;
}

export interface TableFooter {
  /** e.g. "Showing 25 of 42". */
  summary?: ReactNode;
  /** True while the server says there is a next page (keyset cursor present). */
  hasMore: boolean;
  loading?: boolean;
  onLoadMore: () => void;
  loadMoreLabel?: string;
}

export interface TableProps<T> {
  /** Names the table for assistive tech. */
  label: string;
  columns: readonly TableColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectedKey?: string;
  /** md: People users (10px 16px rows). sm: lists inside cards (9px 16px rows). */
  density?: 'md' | 'sm';
  footer?: TableFooter;
  /** Shown instead of rows when there are none, e.g. an EmptyState. */
  empty?: ReactNode;
  className?: string;
}

const PHONE = '(max-width: 639px)';

function subscribePhone(onChange: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(PHONE);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function isPhone() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(PHONE).matches
    : false;
}

/** Whether the viewport is phone-sized, for components that drop columns there. */
export function usePhoneWidth(): boolean {
  return useSyncExternalStore(subscribePhone, isPhone, () => false);
}

const REVEAL =
  'opacity-0 motion-safe:transition-opacity motion-safe:duration-100 group-hover/row:opacity-100 group-focus-within/row:opacity-100 [@media(hover:none)]:opacity-100';

const ALIGN = {
  start: 'justify-self-start text-left',
  center: 'justify-self-center text-center',
  end: 'justify-self-end text-right',
};

/**
 * The review's one table (`.tbl`): sentence-case headings in 12px tx-3 over a line, 44px rows
 * divided by the lighter line, straight on the page with no card around it. Columns are CSS
 * grid tracks. Pagination is keyset: the footer asks for the next page and never shows page
 * numbers.
 */
export function Table<T>({
  label,
  columns,
  rows,
  rowKey,
  onRowClick,
  selectedKey,
  density = 'md',
  footer,
  empty,
  className,
}: TableProps<T>) {
  const phone = usePhoneWidth();
  const shown = phone ? columns.filter((column) => !column.hideOnPhone) : columns;
  const template = { gridTemplateColumns: shown.map((c) => c.width).join(' ') };
  const rowHeight = density === 'md' ? 'min-h-11 py-1.5' : 'min-h-10 py-1';
  const onKey = (event: KeyboardEvent, row: T) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onRowClick?.(row);
    }
  };
  return (
    <div className={cx('min-w-0', className)}>
      <div role="table" aria-label={label} aria-rowcount={rows.length + 1}>
        <div role="rowgroup">
          <div
            role="row"
            style={template}
            className="grid h-8.5 items-center gap-3 border-b border-line px-3 text-12 font-medium text-tx-3"
          >
            {shown.map((column) => (
              <span key={column.key} role="columnheader" className={ALIGN[column.align ?? 'start']}>
                {column.header}
              </span>
            ))}
          </div>
        </div>
        <div role="rowgroup">
          {rows.map((row) => {
            const key = rowKey(row);
            const selected = key === selectedKey;
            return (
              <div
                key={key}
                role="row"
                aria-selected={onRowClick ? selected : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (event) => onKey(event, row) : undefined}
                style={template}
                className={cx(
                  'group/row grid items-center gap-3 border-b border-line-2 px-3 hover:bg-hover',
                  rowHeight,
                  onRowClick && cx('cursor-pointer', focusRingInset),
                  selected && 'bg-acc-50 hover:bg-acc-50',
                )}
              >
                {shown.map((column) => (
                  <div
                    key={column.key}
                    role="cell"
                    className={cx(
                      'min-w-0',
                      ALIGN[column.align ?? 'start'],
                      column.reveal && REVEAL,
                    )}
                  >
                    {column.render(row)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
      {rows.length === 0 && empty}
      {footer && (footer.hasMore || footer.summary) && (
        <div className="flex items-center gap-3 px-3 py-2 text-12 text-tx-3 tabular-nums">
          <span>{footer.summary}</span>
          {footer.hasMore && (
            <Button
              size="xs"
              className="ml-auto"
              loading={footer.loading ?? false}
              onClick={footer.onLoadMore}
            >
              {footer.loadMoreLabel ?? 'Load more'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
