import type { ReactNode } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { focusRingInset } from '../../lib/focus.ts';
import { kanbanGridStyle } from '../kanban-column/kanban-column.tsx';
import { ProgressBar } from '../progress-bar/progress-bar.tsx';

export interface SwimlaneHeaderProps {
  name: ReactNode;
  /** The epic key in mono, after the name. */
  laneKey?: string;
  /** "9 issues · 23 pts" or "6 issues · 2 in flight". */
  meta?: ReactNode;
  /** Percent of points done; draws the 120px bar in the lane colour. */
  progress?: number;
  /** "Due Oct 7", right-aligned. */
  due?: ReactNode;
  /** The lane colour as background utilities for the square and the bar (bg-ac, bg-violet). */
  colorClassName?: string;
  open: boolean;
  onToggle: () => void;
  /** The id of the lane body, so the toggle controls it. */
  controls?: string;
  className?: string;
}

/**
 * The lane's collapsible heading: 8px 12px on bg2 over a br2 rule, a 10px chevron in tx5, the
 * 10px colour square, the name in semibold, the key in mono tx4, the meta, the progress bar
 * and the due date at the end.
 */
export function SwimlaneHeader({
  name,
  laneKey,
  meta,
  progress,
  due,
  colorClassName = 'bg-ac',
  open,
  onToggle,
  controls,
  className,
}: SwimlaneHeaderProps) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
      className={cx(
        'flex w-full cursor-pointer items-center gap-2.5 border-0 border-b border-br2 bg-bg2 px-3 py-2 text-left font-sans text-13 text-tx',
        focusRingInset,
        className,
      )}
    >
      <Icon
        name="chevron"
        size={10}
        className={cx('w-2.5 text-tx5 motion-safe:transition-transform', open && 'rotate-90')}
      />
      <span aria-hidden className={cx('size-2.5 rounded-chip', colorClassName)} />
      <span className="font-semibold">{name}</span>
      {laneKey && <span className="font-mono text-12 font-medium text-tx4">{laneKey}</span>}
      {meta && <span className="text-12 text-tx4">{meta}</span>}
      {progress !== undefined && (
        <ProgressBar
          value={progress}
          label={`${typeof name === 'string' ? name : 'Lane'} progress`}
          fillClassName={colorClassName}
          className="ml-1.5 w-30"
        />
      )}
      {due && <span className="ml-auto text-12 text-tx4">{due}</span>}
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

/** A lane: a bordered 8px card whose body is the column grid, 10px padding on bg2. */
export function Swimlane({ header, columns, open, id, children, className }: SwimlaneProps) {
  return (
    <section className={cx('overflow-hidden rounded-card border border-br bg-sf', className)}>
      {header}
      {open && (
        <div id={id} style={kanbanGridStyle(columns)} className="grid gap-3 bg-bg2 p-2.5">
          {children}
        </div>
      )}
    </section>
  );
}
