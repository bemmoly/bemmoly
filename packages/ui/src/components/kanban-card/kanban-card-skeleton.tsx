import { cx } from '../../lib/cx.ts';
import { Skeleton } from '../skeleton/skeleton.tsx';

export interface KanbanCardSkeletonProps {
  /** Title lines; a long title wraps to two. */
  lines?: 1 | 2;
  /** Whether a row of labels sits under the title. */
  labels?: boolean;
  className?: string;
}

const TITLE_WIDTHS = ['82%', '56%'];

/**
 * A card while the board loads: the card's own box, padding and block rhythm, with bars where
 * the title, labels and footer go, each in a line box of the real text's height, so the real
 * cards land without moving anything.
 */
export function KanbanCardSkeleton({
  lines = 1,
  labels = true,
  className,
}: KanbanCardSkeletonProps) {
  return (
    <div
      aria-hidden
      className={cx(
        'flex flex-col gap-2 rounded-control border border-br bg-sf px-2.5 pt-2.5 pb-2 text-13 shadow-card',
        className,
      )}
    >
      <div className="flex flex-col">
        {TITLE_WIDTHS.slice(0, lines).map((width) => (
          <span key={width} className="flex h-[1.4em] items-center">
            <Skeleton width={lines === 1 ? '74%' : width} height={10} />
          </span>
        ))}
      </div>
      {labels && <Skeleton width={42} height={18} className="rounded-chip" />}
      <div className="flex h-6 items-center gap-1.5 pt-0.5">
        <Skeleton width={14} height={14} className="rounded-chip" />
        <Skeleton width={52} height={9} />
        <Skeleton width={20} height={17} className="ml-auto rounded-pill" />
        <Skeleton width={22} height={22} shape="circle" />
      </div>
    </div>
  );
}
