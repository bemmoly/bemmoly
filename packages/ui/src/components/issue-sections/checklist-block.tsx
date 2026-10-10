import type { HTMLAttributes, ReactNode } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';

export interface ChecklistBlockProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** "Acceptance criteria". */
  title: string;
  done: number;
  total: number;
  /** What the list is for, shown while it is empty. */
  hint?: ReactNode;
  /** The Add button at the end of the header. */
  action?: ReactNode;
  /** CriteriaRows, then the inline add row. */
  children?: ReactNode;
}

/**
 * A checklist as a block of the issue: a bordered 8px box with the checklist icon, the title and
 * a "done / total" counter, then its rows (docs/design/premium/screens.js, screenIssue).
 */
export function ChecklistBlock({
  title,
  done,
  total,
  hint,
  action,
  children,
  className,
  ...rest
}: ChecklistBlockProps) {
  const complete = total > 0 && done === total;
  return (
    <section
      aria-label={title}
      className={cx('flex flex-col rounded-card border border-line px-3.5 py-3', className)}
      {...rest}
    >
      <div className="flex min-h-7 items-center gap-2">
        <span className="flex text-tx-3">
          <Icon name="checklist" size={15} />
        </span>
        <h2 className="m-0 text-13 font-semibold text-tx">{title}</h2>
        <span
          aria-label={`${done} of ${total} met`}
          className={cx(
            'inline-flex h-4.5 items-center rounded-chip px-1.75 text-11 font-semibold tabular-nums',
            complete
              ? 'bg-green-50 text-green-tx'
              : 'bg-sunken text-tx-2 inset-ring inset-ring-line',
          )}
        >
          {done} / {total}
        </span>
        {action && <span className="ml-auto flex items-center">{action}</span>}
      </div>
      {total === 0 && hint && <p className="m-0 mt-1 ml-5.75 text-12h text-tx-3">{hint}</p>}
      {children && <div className="mt-1.5 -mx-1.5 flex flex-col">{children}</div>}
    </section>
  );
}
