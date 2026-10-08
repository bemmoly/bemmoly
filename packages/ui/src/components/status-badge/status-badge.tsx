import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, ICON_SIZE } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';

/** Workflow status categories; every custom status maps to one (Board Settings columns). */
export type StatusCategory = 'todo' | 'progress' | 'review' | 'qa' | 'done';

export const STATUS_LABELS: Record<StatusCategory, string> = {
  todo: 'To do',
  progress: 'In progress',
  review: 'In review',
  qa: 'QA',
  done: 'Done',
};

const COLORS: Record<StatusCategory, string> = {
  todo: 'bg-st-todo-bg text-st-todo-fg',
  progress: 'bg-st-prog-bg text-st-prog-fg',
  review: 'bg-st-rev-bg text-st-rev-fg',
  qa: 'bg-st-qa-bg text-st-qa-fg',
  done: 'bg-st-done-bg text-st-done-fg',
};

export type StatusSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * xs: inline issue chip in docs (10px, 0 5px). sm: subtask rows (11px, 2px 6px).
 * md: list rows in Backlog and Home (11px, 3px 7px, 4px radius, tracked).
 * lg: the drawer status menu (30px, 0 10px, 5px radius, 12px, tracked, caret).
 * xl: the Issue page status menu (32px, 0 12px).
 */
const SIZES: Record<StatusSize, string> = {
  xs: 'rounded-chip px-1.25 text-10 font-semibold',
  sm: 'rounded-chip px-1.5 py-0.5 text-11 font-semibold',
  md: 'rounded-xs px-1.75 py-0.75 text-11 font-semibold tracking-status',
  lg: 'h-7.5 gap-1.5 rounded-sm px-2.5 text-12 font-semibold tracking-status',
  xl: 'h-control gap-1.5 rounded-sm px-3 text-12 font-semibold tracking-status',
};

interface StatusBase {
  category: StatusCategory;
  /** The status name; defaults to the category name. Shown in capitals, as in the mocks. */
  label?: ReactNode;
  size?: StatusSize;
  className?: string;
}

export type StatusBadgeProps = StatusBase;

export function StatusBadge({ category, label, size = 'md', className }: StatusBadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center whitespace-nowrap uppercase',
        COLORS[category],
        SIZES[size],
        className,
      )}
    >
      {label ?? STATUS_LABELS[category]}
    </span>
  );
}

export interface StatusButtonProps
  extends StatusBase, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'> {
  size?: 'lg' | 'xl';
}

/** The status control at the top of the drawer and the Issue page: opens the transition menu. */
export function StatusButton({
  category,
  label,
  size = 'lg',
  className,
  ...rest
}: StatusButtonProps) {
  return (
    <button
      type="button"
      aria-haspopup="menu"
      className={cx(
        'inline-flex shrink-0 cursor-pointer items-center border-0 font-sans whitespace-nowrap uppercase',
        COLORS[category],
        SIZES[size],
        focusRing,
        className,
      )}
      {...rest}
    >
      {label ?? STATUS_LABELS[category]}
      <Icon name="caret" size={ICON_SIZE.small} />
    </button>
  );
}
