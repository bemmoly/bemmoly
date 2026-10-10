import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';
import { IconButton } from '../button/icon-button.tsx';
import { StatusGlyph, type StatusStage } from '../glyphs/glyphs.tsx';

/** The board's column tracks: equal columns 10px apart (docs/design/premium/kit.css, `.cols`). */
export function kanbanGridStyle(columns: number): CSSProperties {
  return { gridTemplateColumns: `repeat(${columns},minmax(0,1fr))` };
}

export interface KanbanColumnHeaderProps {
  name: string;
  /** Where the column's first status sits; draws the status glyph. */
  stage: StatusStage;
  count: number;
  /** The WIP limit: a chip that turns amber once the count reaches it. */
  wipLimit?: number;
  /** Adds an issue at the foot of this column. */
  onAdd?: () => void;
  /** The column's ··· menu, already wired to its own trigger. */
  menu?: ReactNode;
  className?: string;
}

/**
 * One column heading (kit.css `.colh`): 32px, the status glyph, the name in sentence case, the
 * count, the WIP chip, and + and ··· that show on hover and keyboard focus.
 */
export function KanbanColumnHeader({
  name,
  stage,
  count,
  wipLimit,
  onAdd,
  menu,
  className,
}: KanbanColumnHeaderProps) {
  const reached = wipLimit !== undefined && count >= wipLimit;
  const over = wipLimit !== undefined && count > wipLimit;
  return (
    <div
      className={cx(
        'group/colh flex h-8 min-w-0 items-center gap-1.75 px-1 text-13 font-semibold text-tx',
        className,
      )}
    >
      <StatusGlyph stage={stage} label={name} />
      <span className="truncate" title={name}>
        {name}
      </span>
      <span
        aria-label={`${count} ${count === 1 ? 'issue' : 'issues'}`}
        className="font-medium text-tx-3 tabular-nums"
      >
        {count}
      </span>
      {wipLimit !== undefined && (
        <span
          aria-label={over ? `Over the WIP limit of ${wipLimit}` : `WIP limit ${wipLimit}`}
          className={cx(
            'shrink-0 rounded-xs px-1.25 text-11 leading-4.25 font-semibold whitespace-nowrap tabular-nums',
            reached
              ? 'bg-amber-50 text-amber-tx'
              : 'bg-sunken text-tx-3 ring-1 ring-line ring-inset',
          )}
        >
          {count} / {wipLimit} WIP
        </span>
      )}
      <span
        className={cx(
          'ml-auto flex shrink-0 gap-0.5 text-tx-3',
          'opacity-0 group-focus-within/colh:opacity-100 group-hover/colh:opacity-100 has-[[aria-expanded=true]]:opacity-100 pointer-coarse:opacity-100',
        )}
      >
        {onAdd && (
          <IconButton
            keys="C"
            size="tool"
            label={`New issue in ${name}`}
            icon="plus"
            onClick={onAdd}
          />
        )}
        {menu}
      </span>
    </div>
  );
}

export interface KanbanColumnHeadersProps {
  children: ReactNode;
  columns: number;
  className?: string;
}

/** The sticky heading row over the lanes, on the board's sunken canvas. */
export function KanbanColumnHeaders({ children, columns, className }: KanbanColumnHeadersProps) {
  return (
    <div
      style={kanbanGridStyle(columns)}
      className={cx('sticky top-0 z-2 grid gap-2.5 bg-sunken pt-1', className)}
    >
      {children}
    </div>
  );
}

export interface KanbanCellProps extends HTMLAttributes<HTMLDivElement> {
  /** Names the drop area, e.g. "In review, Auth service". */
  label: string;
  /** A drag is over this cell and may land: the dashed accent frame. */
  dropping?: boolean;
  /** A drag is over this cell and the workflow refuses it: the dashed amber frame. */
  refused?: boolean;
  /** Compact cards sit 6px apart instead of 8px. */
  compact?: boolean;
}

/** The drop area of one column inside a lane: cards 8px apart, 2px above and 8px below. */
export function KanbanCell({
  label,
  dropping = false,
  refused = false,
  compact = false,
  className,
  children,
  ...rest
}: KanbanCellProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cx(
        'flex min-h-11 min-w-0 flex-col rounded-card pt-0.5 pb-2 motion-safe:transition-colors',
        compact ? 'gap-1.5' : 'gap-2',
        // An outline, not a border, so a drag over the cell never nudges its cards by a pixel.
        dropping && 'bg-acc-50 outline-1 -outline-offset-1 outline-acc-100 outline-dashed',
        refused && 'bg-amber-50 outline-1 -outline-offset-1 outline-amber outline-dashed',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
