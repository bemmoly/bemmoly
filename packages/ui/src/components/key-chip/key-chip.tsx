import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';

export type KeyChipSize = 'sm' | 'md';

/** sm: cards and rows (11.5px tx4). md: drawer header and breadcrumbs (12px tx2). */
const SIZES: Record<KeyChipSize, string> = {
  sm: 'text-12 text-tx-3',
  md: 'text-12 text-tx-2',
};

export interface KeyChipProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /** The issue key, e.g. PLT-204. */
  issueKey: string;
  size?: KeyChipSize;
  /** The bordered inline chip used inside docs, with a type square and a status. */
  inline?: boolean;
  /** Content after the key in the inline chip, such as a StatusBadge size="xs". */
  children?: ReactNode;
  /** Colour square before the key in the inline chip (Tailwind bg class from tokens). */
  typeClassName?: string;
}

/** An issue key in IBM Plex Mono 500. Renders a link when href is given. */
export function KeyChip({
  issueKey,
  size = 'sm',
  inline,
  children,
  typeClassName,
  href,
  className,
  ...rest
}: KeyChipProps) {
  const classes = inline
    ? cx(
        'inline-flex items-center gap-1.25 rounded-chip border border-line bg-card px-1.75 py-px align-middle',
        'font-mono text-12 font-medium text-tx no-underline',
      )
    : cx('font-mono font-medium whitespace-nowrap no-underline', SIZES[size]);
  const content = (
    <>
      {inline && typeClassName && (
        <span aria-hidden className={cx('size-2 rounded-tick', typeClassName)} />
      )}
      {issueKey}
      {children}
    </>
  );
  if (href) {
    return (
      <a href={href} className={cx(classes, focusRing, className)} {...rest}>
        {content}
      </a>
    );
  }
  return <span className={cx(classes, className)}>{content}</span>;
}
