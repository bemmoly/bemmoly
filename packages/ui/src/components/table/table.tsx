import {
  type CSSProperties,
  useRef,
  useSyncExternalStore,
  type KeyboardEvent,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { cx } from '../../lib/cx.ts';
import { focusRingInset } from '../../lib/focus.ts';
import { Button } from '../button/button.tsx';
import { ALIGN, HEAD_ROW, TableHeading, type TableSort } from './table-head.tsx';
import { VirtualRows, type TableVirtual } from './table-virtual.tsx';

export interface TableColumn<T> {
  key: string;
  header: ReactNode;
  /** A CSS grid track: "minmax(0,1.4fr)", "150px", "28px". */
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
  /** The heading sorts by this column; the caller sorts the rows. */
  sortable?: boolean;
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
  /** Right-click on a row, e.g. to open its ··· menu where the pointer is. */
  onRowContextMenu?: (row: T, event: MouseEvent<HTMLElement>) => void;
  selectedKey?: string;
  /** Faded rows: archived ones, or a removal waiting on Undo. */
  isMuted?: (row: T) => boolean;
  /** md: 44px rows. sm: 40px rows for lists inside panels. */
  density?: 'md' | 'sm';
  sort?: TableSort;
  onSort?: (sort: TableSort) => void;
  footer?: TableFooter;
  /** Shown instead of rows when there are none, e.g. an EmptyState. */
  empty?: ReactNode;
  /** Extra attributes per row, such as the drop handlers of a reorderable list. */
  rowProps?: (row: T, index: number) => HTMLAttributes<HTMLDivElement> & { 'data-over'?: boolean };
  /**
   * Long lists (hundreds of rows): only the rows in view are drawn, on the page's own scroll
   * area, so a catalog of a thousand applications scrolls like ten. Rows are one fixed height.
   */
  virtual?: TableVirtual;
  /** Called when the last rows come into view: load the next keyset page. */
  onEndReached?: () => void;
  /** How many rows exist in all, when more pages are still to load (for aria-rowcount). */
  total?: number;
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

/**
 * A secondary control inside a row (a star, a grip): shown on the row's hover or focus, while
 * its own menu is open, and always on touch screens.
 */
export const rowReveal =
  'opacity-0 motion-safe:transition-opacity motion-safe:duration-100 group-hover/row:opacity-100 group-focus-within/row:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 [@media(hover:none)]:opacity-100';

const NAV_KEYS: Record<string, number> = { ArrowDown: 1, j: 1, ArrowUp: -1, k: -1 };

/**
 * The review's one table (`.tbl`): sentence-case headings in 12px tx-3 over a line, 44px rows
 * divided by the lighter line, straight on the page with no card around it. Columns are CSS
 * grid tracks. Rows that open move with ↑↓ or j k and open with Enter; headings can sort.
 * Pagination is keyset: the footer asks for the next page and never shows page numbers.
 */
export function Table<T>({
  label,
  columns,
  rows,
  rowKey,
  onRowClick,
  onRowContextMenu,
  selectedKey,
  isMuted,
  density = 'md',
  sort,
  onSort,
  footer,
  empty,
  rowProps,
  virtual,
  onEndReached,
  total,
  className,
}: TableProps<T>) {
  const body = useRef<HTMLDivElement>(null);
  const phone = usePhoneWidth();
  const shown = phone ? columns.filter((column) => !column.hideOnPhone) : columns;
  const template = { gridTemplateColumns: shown.map((c) => c.width).join(' ') };
  const rowHeight = density === 'md' ? 'min-h-11 py-1.5' : 'min-h-10 py-1';
  const onKey = (event: KeyboardEvent<HTMLDivElement>, row: T) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onRowClick?.(row);
      return;
    }
    const step = NAV_KEYS[event.key];
    if (!step || event.metaKey || event.ctrlKey || event.altKey) return;
    const all = [...(body.current?.querySelectorAll<HTMLElement>('[role="row"][tabindex]') ?? [])];
    const next = all[all.indexOf(event.currentTarget) + step];
    if (!next) return;
    event.preventDefault();
    next.focus();
  };
  const renderRow = (row: T, index: number, style?: CSSProperties) => {
    const key = rowKey(row);
    const selected = key === selectedKey;
    return (
      <div
        {...rowProps?.(row, index)}
        key={key}
        role="row"
        aria-rowindex={index + 2}
        aria-selected={onRowClick ? selected : undefined}
        tabIndex={onRowClick ? 0 : undefined}
        onClick={onRowClick ? () => onRowClick(row) : undefined}
        onContextMenu={onRowContextMenu ? (event) => onRowContextMenu(row, event) : undefined}
        onKeyDown={onRowClick ? (event) => onKey(event, row) : undefined}
        style={{ ...template, ...style }}
        className={cx(
          'group/row grid items-center gap-3 border-b border-line-2 px-3 hover:bg-hover',
          rowHeight,
          onRowClick && cx('cursor-pointer', focusRingInset),
          selected && 'bg-acc-50 hover:bg-acc-50',
          isMuted?.(row) && 'text-tx-3 [&_*]:text-tx-3',
          'data-[over=true]:shadow-[inset_0_2px_0_var(--acc)]',
        )}
      >
        {shown.map((column) => (
          <div
            key={column.key}
            role="cell"
            className={cx('min-w-0', ALIGN[column.align ?? 'start'], column.reveal && rowReveal)}
          >
            {column.render(row)}
          </div>
        ))}
      </div>
    );
  };
  return (
    <div className={cx('min-w-0', className)}>
      <div role="table" aria-label={label} aria-rowcount={(total ?? rows.length) + 1}>
        <div role="rowgroup">
          <div role="row" style={template} className={HEAD_ROW}>
            {shown.map((column) => (
              <TableHeading key={column.key} column={column} sort={sort} onSort={onSort} />
            ))}
          </div>
        </div>
        <div role="rowgroup" ref={body}>
          {virtual ? (
            <VirtualRows
              rows={rows}
              rowKey={rowKey}
              virtual={virtual}
              onEndReached={onEndReached}
              renderRow={renderRow}
            />
          ) : (
            rows.map((row, index) => renderRow(row, index))
          )}
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

export type { SortDirection, TableSort } from './table-head.tsx';
export type { TableVirtual } from './table-virtual.tsx';
