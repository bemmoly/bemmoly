import type { KeyboardEvent, ReactNode } from 'react';
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

const ALIGN = {
  start: 'justify-self-start text-left',
  center: 'justify-self-center text-center',
  end: 'justify-self-end text-right',
};

/**
 * The grid table of the People and Board Settings mocks: header on sf2 in 11px tracked capitals,
 * rows divided by br-row, columns as CSS grid tracks. Pagination is keyset: the footer asks for
 * the next page and never shows page numbers.
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
  const template = { gridTemplateColumns: columns.map((c) => c.width).join(' ') };
  const rowPad = density === 'md' ? 'py-2.5' : 'py-2.25';
  const onKey = (event: KeyboardEvent, row: T) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onRowClick?.(row);
    }
  };
  return (
    <div className={cx('overflow-hidden rounded-card border border-br bg-sf', className)}>
      <div role="table" aria-label={label} aria-rowcount={rows.length + 1}>
        <div role="rowgroup">
          <div
            role="row"
            style={template}
            className="grid items-end gap-3 border-b border-br2 bg-sf2 px-4 py-2.25 text-11 font-medium tracking-caps text-tx5 uppercase"
          >
            {columns.map((column) => (
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
                  'grid items-center gap-3 border-b border-br-row px-4',
                  rowPad,
                  onRowClick && cx('cursor-pointer hover:bg-hover', focusRingInset),
                  selected && 'bg-acc-50 hover:bg-acc-50',
                )}
              >
                {columns.map((column) => (
                  <div
                    key={column.key}
                    role="cell"
                    className={cx('min-w-0', ALIGN[column.align ?? 'start'])}
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
        <div className="flex items-center gap-3 bg-sf2 px-4 py-2 text-12h text-tx4">
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
