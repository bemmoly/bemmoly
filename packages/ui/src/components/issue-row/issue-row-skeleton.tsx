import { cx } from '../../lib/cx.ts';
import { Skeleton } from '../skeleton/skeleton.tsx';
import { ISSUE_ROW_GRID, issueRowTracks } from './issue-row.tsx';

const TITLES = ['64%', '48%', '72%', '56%', '40%', '68%'];

/**
 * An issue row while the list loads: the row's tracks, height and rule, with bars in place of
 * its parts, so the loaded rows land without moving anything.
 */
export function IssueRowSkeleton({
  index = 0,
  epic = false,
  className,
}: {
  index?: number;
  epic?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      style={issueRowTracks(epic)}
      className={cx(
        ISSUE_ROW_GRID,
        'h-9 items-center gap-2.5 border-b border-line-2 pr-6 pl-4 max-sm:pr-7',
        className,
      )}
    >
      <span />
      <Skeleton width={16} height={16} className="rounded-chip" />
      <Skeleton width={52} height={9} />
      <Skeleton width={TITLES[index % TITLES.length]} height={10} />
      {epic && <Skeleton width={84} height={9} className="max-sm:hidden" />}
      <Skeleton width={14} height={14} shape="circle" />
      <Skeleton width={14} height={10} />
      <Skeleton width={18} height={18} className="rounded-full" />
      <Skeleton width={20} height={20} shape="circle" />
    </div>
  );
}
