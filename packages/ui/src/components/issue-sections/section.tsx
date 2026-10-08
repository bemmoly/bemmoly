import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';

export interface SectionHeadingProps {
  title: ReactNode;
  /** Right-aligned light text, e.g. "2 of 4 done" (12px tx4). */
  hint?: ReactNode;
  /** Content at the end of the row, such as the Activity segmented control. */
  actions?: ReactNode;
  /** page: the Issue page (14px). panel: the drawer (13px). */
  size?: 'page' | 'panel';
  className?: string;
}

/** A section title on the Issue page or in the drawer, 8px above its content. */
export function SectionHeading({
  title,
  hint,
  actions,
  size = 'page',
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cx(
        'flex items-center gap-2.5 font-semibold text-tx',
        size === 'page' ? 'text-14' : 'text-13',
        className,
      )}
    >
      <span>{title}</span>
      {hint && <span className="ml-auto text-12 font-normal text-tx4">{hint}</span>}
      {actions && <span className={cx('flex items-center', !hint && 'ml-auto')}>{actions}</span>}
    </div>
  );
}

export interface IssueSectionProps extends HTMLAttributes<HTMLElement> {
  heading: ReactNode;
  children: ReactNode;
}

/** A heading and its content 8px apart; sections sit 20px apart on the page, 18px in the drawer. */
export function IssueSection({ heading, children, className, ...rest }: IssueSectionProps) {
  return (
    <section className={cx('flex flex-col gap-2', className)} {...rest}>
      {heading}
      {children}
    </section>
  );
}

export type ListCardProps = HTMLAttributes<HTMLDivElement>;

/** The bordered 7px list the subtasks and linked issues sit in; rows divide themselves. */
export function ListCard({ className, ...rest }: ListCardProps) {
  return (
    <div
      className={cx(
        'flex flex-col overflow-hidden rounded-panel border border-br bg-sf text-13 text-tx [&>:last-child]:border-b-0',
        className,
      )}
      {...rest}
    />
  );
}

/** "blocks", "relates to": the group label inside a ListCard, 7px 12px on sf2 in 12px tx4. */
export function ListGroupLabel({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        'border-b border-br-row bg-sf2 px-3 py-1.75 text-12 font-medium text-tx4',
        className,
      )}
      {...rest}
    />
  );
}
