import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';

/** The three categories the workflow canvas colours by: tx5, the accent and ok. */
export type WorkflowCategory = 'todo' | 'progress' | 'done';

export const WORKFLOW_CATEGORY: Record<WorkflowCategory, { name: string; dot: string }> = {
  todo: { name: 'To do', dot: 'bg-tx5' },
  progress: { name: 'In progress', dot: 'bg-ac' },
  done: { name: 'Done', dot: 'bg-ok' },
};

export interface StatusDotProps {
  category: WorkflowCategory;
  /** A status's own colour (bg-violet, bg-caution) in place of its category's. */
  colorClassName?: string;
  /** 8px in status pills, 9px on nodes, 10px in the panel heading. */
  size?: 8 | 9 | 10;
  className?: string;
}

const DOT_SIZES = { 8: 'size-2', 9: 'size-2.25', 10: 'size-2.5' } as const;

/** The round status colour mark. */
export function StatusDot({ category, colorClassName, size = 9, className }: StatusDotProps) {
  return (
    <span
      aria-hidden
      className={cx(
        'inline-block shrink-0 rounded-full',
        DOT_SIZES[size],
        colorClassName ?? WORKFLOW_CATEGORY[category].dot,
        className,
      )}
    />
  );
}

export interface StatusNodeProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'name'> {
  name: ReactNode;
  category: WorkflowCategory;
  colorClassName?: string;
  /** Issues in this status now; the line shows the category alone while it is unknown. */
  count?: number;
  selected?: boolean;
  /** A problem from validation names this status: the danger border in place of br3. */
  invalid?: boolean;
  /** Centre of the node in canvas percentages, as the mock positions them. */
  x: string;
  y: string;
}

/**
 * A status on the canvas: 150px wide, 10px 12px, 8px radius, a 1.5px br3 border with the card
 * shadow; selected takes the accent border and the 3px ring. The name is 12.5px semibold after
 * its 9px dot; the category and count sit under it in 11px tx5.
 */
export function StatusNode({
  name,
  category,
  colorClassName,
  count,
  selected = false,
  invalid = false,
  x,
  y,
  className,
  style,
  type = 'button',
  ...rest
}: StatusNodeProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      aria-invalid={invalid || undefined}
      style={{ left: x, top: y, ...style }}
      className={cx(
        'absolute flex w-37.5 -translate-1/2 cursor-pointer flex-col gap-1 rounded-card border-[1.5px] bg-sf px-3 py-2.5 text-left font-sans text-tx',
        selected ? 'shadow-ring-node' : 'shadow-card',
        invalid ? 'border-danger' : selected ? 'border-ac' : 'border-br3',
        focusRing,
        className,
      )}
      {...rest}
    >
      <span className="flex items-center gap-1.75">
        <StatusDot category={category} colorClassName={colorClassName} />
        <span className="text-12h font-semibold">{name}</span>
      </span>
      <span className="text-11 text-tx5">
        {WORKFLOW_CATEGORY[category].name}
        {count === undefined ? '' : ` · ${count} ${count === 1 ? 'issue' : 'issues'}`}
      </span>
    </button>
  );
}

export interface StatusNodeHandleProps extends HTMLAttributes<HTMLSpanElement> {
  /** The node's centre in canvas percentages; the handle sits on its right edge. */
  x: string;
  y: string;
}

/**
 * The connector on a node's right edge that a transition is drawn from: a 10px accent ring on
 * the surface, filled while pressed. Pointer only; the side panel's "Add transition" is the
 * keyboard path, so it stays out of the tab order.
 */
export function StatusNodeHandle({ x, y, className, style, ...rest }: StatusNodeHandleProps) {
  return (
    <span
      aria-hidden
      style={{ left: `calc(${x} + 75px)`, top: y, ...style }}
      className={cx(
        'absolute size-2.5 -translate-1/2 cursor-crosshair rounded-full border-2 border-ac bg-sf active:bg-ac',
        className,
      )}
      {...rest}
    />
  );
}

export interface StatusPillProps {
  name: ReactNode;
  category: WorkflowCategory;
  colorClassName?: string;
  /** The mono count in tx5 at the end (Board Settings columns). */
  count?: number;
  /** Fills the row (the columns' status cards) rather than hugging its text (unmapped statuses). */
  block?: boolean;
  className?: string;
}

/** A status in Board Settings: 8px dot, the name and a count in a br-bordered 6px frame. */
export function StatusPill({
  name,
  category,
  colorClassName,
  count,
  block,
  className,
}: StatusPillProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-control border border-br bg-sf text-12h text-tx',
        block ? 'flex gap-2 px-2.25 py-1.75' : 'px-2.25 py-1',
        className,
      )}
    >
      <StatusDot category={category} colorClassName={colorClassName} size={8} />
      <span className={cx(block && 'flex-1')}>{name}</span>
      {count !== undefined && <span className="font-mono text-11 text-tx5">{count}</span>}
    </span>
  );
}
