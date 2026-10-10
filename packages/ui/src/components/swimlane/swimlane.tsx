import type { ReactNode } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { focusRingInset } from '../../lib/focus.ts';
import { kanbanGridStyle } from '../kanban-column/kanban-column.tsx';

export interface SwimlaneHeaderProps {
  name: string;
  /** The epic key in mono, after the name. */
  laneKey?: string;
  /** "9 issues · 26 pts" or "6 issues · 2 in flight". */
  meta?: ReactNode;
  /** Percent of points done; draws the 90px bar in the lane colour. */
  progress?: number;
  /** "Due Oct 12", right-aligned. */
  due?: ReactNode;
  /** The lane colour as a background utility (see epicFill); omitted for lanes without one. */
  colorClassName?: string;
  open: boolean;
  onToggle: () => void;
  /** The id of the lane body, so the toggle controls it. */
  controls?: string;
  className?: string;
}

/**
 * A lane's heading (docs/design/premium/kit.css, `.laneh`): no box around it, just a 34px line
 * on the board's canvas with the chevron, the epic's own colour square, its name, key, counts,
 * a thin progress bar in the same colour and the due date at the end.
 */
export function SwimlaneHeader({
  name,
  laneKey,
  meta,
  progress,
  due,
  colorClassName,
  open,
  onToggle,
  controls,
  className,
}: SwimlaneHeaderProps) {
  const pct = progress === undefined ? undefined : Math.max(0, Math.min(100, progress));
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
      className={cx(
        'flex h-8.5 w-full cursor-pointer items-center gap-2 rounded-panel border-0 bg-transparent px-1 text-left font-sans text-13 text-tx',
        'hover:bg-hover motion-safe:transition-colors',
        focusRingInset,
        className,
      )}
    >
      <Icon
        name="chevron"
        size={14}
        className={cx('text-tx-3 motion-safe:transition-transform', open && 'rotate-90')}
      />
      {colorClassName && (
        <i aria-hidden className={cx('size-2.5 shrink-0 rounded-[3px]', colorClassName)} />
      )}
      <span className="truncate font-semibold">{name}</span>
      {laneKey && <span className="font-mono text-12 text-tx-3">{laneKey}</span>}
      {meta && <span className="shrink-0 text-tx-3 tabular-nums">{meta}</span>}
      {pct !== undefined && (
        <span
          role="progressbar"
          aria-label={`${name} progress`}
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1 w-22.5 shrink-0 overflow-hidden rounded-[2px] bg-line"
        >
          <i
            className={cx('block h-full rounded-[2px]', colorClassName ?? 'bg-tx-3')}
            style={{ width: `${pct}%` }}
          />
        </span>
      )}
      {due && <span className="ml-auto shrink-0 text-tx-3 tabular-nums">{due}</span>}
    </button>
  );
}

export interface SwimlaneProps {
  header: ReactNode;
  /** Column count; the body lays its cells out on the board grid. */
  columns: number;
  open: boolean;
  id?: string;
  children?: ReactNode;
  className?: string;
}

/** A lane: its heading over the column grid, 8px below the previous lane. */
export function Swimlane({ header, columns, open, id, children, className }: SwimlaneProps) {
  return (
    <section className={cx('mt-2', className)}>
      {header}
      {open && (
        <div id={id} style={kanbanGridStyle(columns)} className="grid gap-2.5">
          {children}
        </div>
      )}
    </section>
  );
}
