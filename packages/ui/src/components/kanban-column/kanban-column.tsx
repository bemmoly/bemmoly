import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';

/** The board's column tracks: equal columns 12px apart, as the Board mock's grid. */
export function kanbanGridStyle(columns: number): CSSProperties {
  return { gridTemplateColumns: `repeat(${columns},minmax(0,1fr))` };
}

export interface KanbanColumnHeaderProps {
  name: ReactNode;
  count: number;
  /** The WIP limit; the count reads "n/limit" and turns warn with a badge when over. */
  wipLimit?: number;
  /** Adds an issue straight into this column. */
  onAdd?: () => void;
  className?: string;
}

/**
 * One column heading: 24px tall, 6px side padding, the name in 11.5px tracked capitals (tx3),
 * the mono count in tx5, then "WIP limit" in the warn pair when the column is over, and "+"
 * at the end in tx6.
 */
export function KanbanColumnHeader({
  name,
  count,
  wipLimit,
  onAdd,
  className,
}: KanbanColumnHeaderProps) {
  const over = wipLimit !== undefined && count > wipLimit;
  return (
    <div className={cx('flex h-6 items-center gap-2 px-1.5', className)}>
      <span className="text-11h font-semibold tracking-label text-tx3 uppercase">{name}</span>
      <span
        aria-label={wipLimit === undefined ? `${count} issues` : `${count} of ${wipLimit} allowed`}
        className={cx('font-mono text-11h font-medium', over ? 'text-warn-fg' : 'text-tx5')}
      >
        {wipLimit === undefined ? count : `${count}/${wipLimit}`}
      </span>
      {over && (
        <span className="rounded-chip bg-warn-bg px-1.5 py-px text-10h font-medium text-warn-fg">
          WIP limit
        </span>
      )}
      {onAdd && (
        <button
          type="button"
          aria-label={`Add issue to ${typeof name === 'string' ? name : 'column'}`}
          onClick={onAdd}
          className={cx(
            'ml-auto flex cursor-pointer items-center border-0 bg-transparent p-0 font-semibold text-tx6 hover:text-tx2',
            focusRing,
          )}
        >
          <Icon name="plus" size={14} />
        </button>
      )}
    </div>
  );
}

export interface KanbanColumnHeadersProps {
  children: ReactNode;
  columns: number;
  className?: string;
}

/** The sticky heading row over the lanes: the grid with 2px 11px 10px padding on the page bg. */
export function KanbanColumnHeaders({ children, columns, className }: KanbanColumnHeadersProps) {
  return (
    <div
      style={kanbanGridStyle(columns)}
      className={cx('sticky top-0 z-2 grid gap-3 bg-bg px-2.75 pt-0.5 pb-2.5', className)}
    >
      {children}
    </div>
  );
}

export interface KanbanCellProps extends HTMLAttributes<HTMLDivElement> {
  /** Names the drop area, e.g. "In review, Auth service". */
  label: string;
  /** A drag is over this cell: the dashed accent frame of the Board Settings drop zone. */
  dropping?: boolean;
}

/**
 * The drop area of one column inside a lane: cards 8px apart, at least 44px tall, 6px radius.
 * The mock paints no idle background; the drop state is built from the Board Settings "Drop
 * status here" frame on the accent tint.
 */
export function KanbanCell({
  label,
  dropping = false,
  className,
  children,
  ...rest
}: KanbanCellProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cx(
        'flex min-h-11 flex-col gap-2 rounded-control motion-safe:transition-colors',
        // An outline, not a border, so a drag over the cell never nudges its cards by a pixel.
        dropping && 'bg-ac-bg2 outline-1 -outline-offset-1 outline-ac-br outline-dashed',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
