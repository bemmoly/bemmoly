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
  todo: 'bg-line-2 text-tx-2',
  progress: 'bg-acc-50 text-acc',
  review: 'bg-acc-50 text-acc',
  qa: 'bg-acc-50 text-acc',
  done: 'bg-green-50 text-green-tx',
};

export type StatusSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * xs: inline issue chip in docs (10px, 0 5px). sm: subtask rows (11px, 2px 6px).
 * md: list rows in Backlog and Home (11px, 3px 7px, 4px radius, tracked).
 * lg: the drawer status menu (30px, 0 10px, 5px radius, 12px, tracked, caret).
 * xl: the Issue page status menu (32px, 0 12px).
 */
const SIZES: Record<StatusSize, string> = {
  xs: 'rounded-chip px-1.25 text-11 font-semibold',
  sm: 'rounded-chip px-1.5 py-0.5 text-11 font-semibold',
  md: 'rounded-chip px-1.75 py-0.75 text-11 font-semibold',
  lg: 'h-7.5 gap-1.5 rounded-chip px-2.5 text-12 font-semibold',
  xl: 'h-control gap-1.5 rounded-chip px-3 text-12 font-semibold',
};

interface StatusBase {
  category: StatusCategory;
  /** The status name; defaults to the category name. Sentence case, as the review asks. */
  label?: ReactNode;
  size?: StatusSize;
  className?: string;
}

export type StatusBadgeProps = StatusBase;

export function StatusBadge({ category, label, size = 'md', className }: StatusBadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center whitespace-nowrap',
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
        'inline-flex shrink-0 cursor-pointer items-center border-0 font-sans whitespace-nowrap',
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
