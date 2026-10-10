import { cx } from '../../lib/cx.ts';
import { Skeleton } from '../skeleton/skeleton.tsx';

export interface IssueCardSkeletonProps {
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
export function IssueCardSkeleton({ lines = 1, labels = true, className }: IssueCardSkeletonProps) {
  return (
    <div
      aria-hidden
      className={cx(
        'flex flex-col gap-2 rounded-card bg-card px-2.75 pt-2.5 pb-2.25 text-13 shadow-e1',
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
      {labels && <Skeleton width={46} height={20} className="rounded-full" />}
      <div className="flex h-5 items-center gap-1.5">
        <Skeleton width={16} height={16} className="rounded-chip" />
        <Skeleton width={52} height={9} />
        <Skeleton width={16} height={12} className="ml-auto" />
        <Skeleton width={18} height={18} className="rounded-full" />
        <Skeleton width={20} height={20} shape="circle" />
      </div>
    </div>
  );
}
