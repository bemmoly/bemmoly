import { cx } from '../../lib/cx.ts';
import { Skeleton } from '../skeleton/skeleton.tsx';
import { BACKLOG_ROW_TEMPLATE } from './backlog-row.tsx';

const TITLES = ['64%', '48%', '72%', '56%', '40%', '68%'];

/**
 * A backlog row while the sprints load: the row's nine tracks, padding and rule, with bars in
 * place of its parts, as tall as a loaded row.
 */
export function BacklogRowSkeleton({
  index = 0,
  className,
}: {
  index?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      style={{ gridTemplateColumns: BACKLOG_ROW_TEMPLATE }}
      className={cx(
        'grid items-center gap-2.5 border-b border-br-row bg-sf px-3.5 py-2 text-13',
        className,
      )}
    >
      <span />
      <Skeleton width={14} height={14} className="rounded-chip" />
      <Skeleton width={56} height={9} />
      <span className="flex h-5.5 items-center">
        <Skeleton width={TITLES[index % TITLES.length]} height={10} />
      </span>
      <Skeleton width={72} height={9} />
      <Skeleton width={64} height={18} className="rounded-xs" />
      <Skeleton width={12} height={10} />
      <Skeleton width="100%" height={17} className="rounded-pill" />
      <Skeleton width={22} height={22} shape="circle" />
    </div>
  );
}
