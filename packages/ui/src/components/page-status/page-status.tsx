import { StatusGlyph, type StatusStage } from '../glyphs/status-glyph.tsx';
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

/**
 * A page's status on the status glyph family (docs/design/premium/docs/docs-kit.js, `PSTATUS`):
 * draft fills like a to-do, in review like work under review, published is done, archived is
 * set aside. Colour comes from the glyph's category, never from a signal colour.
 */
export const PAGE_STATUS_STAGES: Record<PageStatus, StatusStage> = {
  draft: 'todo',
  in_review: 'review',
  published: 'done',
  archived: 'wont',
};

/** The status as its glyph and its name in sentence case: the header's status menu, lists. */
export function PageStatusMark({ status, className }: PageStatusPillProps) {
  return (
    <span className={cx('inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap', className)}>
      <StatusGlyph stage={PAGE_STATUS_STAGES[status]} size={13} decorative />
      {PAGE_STATUS_LABELS[status]}
    </span>
  );
}
