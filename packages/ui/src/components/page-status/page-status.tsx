import { cx } from '../../lib/cx.ts';

/** Where a page is in its review flow. */
export type PageStatus = 'draft' | 'in_review' | 'published' | 'archived';

export const PAGE_STATUS_LABELS: Record<PageStatus, string> = {
  draft: 'Draft',
  in_review: 'In review',
  published: 'Published',
  archived: 'Archived',
};

/**
 * The Doc Editor mock draws IN REVIEW on the amber pair; the other states take the status
 * pairs the board uses for the same meaning: draft is "to do", published is "done",
 * archived is quiet on the chip.
 */
const TONES: Record<PageStatus, string> = {
  draft: 'bg-line-2 text-tx-2',
  in_review: 'bg-acc-50 text-acc',
  published: 'bg-green-50 text-green-tx',
  archived: 'bg-line-2 text-tx-3',
};

export interface PageStatusPillProps {
  status: PageStatus;
  className?: string;
}

/** The status beside a page's breadcrumbs and in lists: 11px semibold capitals, 2px 7px, 3px. */
export function PageStatusPill({ status, className }: PageStatusPillProps) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center rounded-chip px-1.75 py-0.5 text-11 font-semibold whitespace-nowrap uppercase',
        TONES[status],
        className,
      )}
    >
      {PAGE_STATUS_LABELS[status]}
    </span>
  );
}
