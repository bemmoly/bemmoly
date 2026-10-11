import type { ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';

/** The dot before an item: warn for people waiting, caution for stale, accent for the rest. */
export type AttentionTone = 'warn' | 'caution' | 'accent';

const DOTS: Record<AttentionTone, string> = {
  warn: 'bg-amber',
  caution: 'bg-amber',
  accent: 'bg-acc',
};

export interface AttentionItemProps {
  tone: AttentionTone;
  /** One line with the subject in bold and the page as a link. */
  children: ReactNode;
  /** Who and since when, in tx5. */
  meta?: ReactNode;
  className?: string;
}

/**
 * A line of the "Needs attention" panel: a 7px dot 5px down, 10px from the text, 11px 16px
 * padding, 12.5px at 1.45, divided by br-row.
 */
export function AttentionItem({ tone, children, meta, className }: AttentionItemProps) {
  return (
    <li
      className={cx(
        'flex items-start gap-2.5 border-b border-line-2 px-4 py-2.75 last:border-b-0',
        className,
      )}
    >
      <span aria-hidden className={cx('mt-1.25 size-1.75 shrink-0 rounded-full', DOTS[tone])} />
      <span className="flex min-w-0 flex-col gap-0.5 text-13 leading-note">
        <span className="text-tx [&_b]:font-semibold">{children}</span>
        {meta && <span className="text-tx-3">{meta}</span>}
      </span>
    </li>
  );
}

export interface AttentionListProps {
  children: ReactNode;
  label?: string;
  className?: string;
}

export function AttentionList({ children, label, className }: AttentionListProps) {
  return (
    <ul aria-label={label} className={cx('m-0 flex list-none flex-col p-0', className)}>
      {children}
    </ul>
  );
}
