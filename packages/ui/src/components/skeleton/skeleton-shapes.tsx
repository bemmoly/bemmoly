import { cx } from '../../lib/cx.ts';
import { Skeleton } from './skeleton.tsx';

/*
 * Placeholders with the final layout's heights and gaps (docs/design/premium/kit.css), so
 * nothing moves when the data lands. Mark the loading region aria-busy; these are hidden from
 * assistive tech.
 */

/** A 36px list row: type glyph, key, title, then status, avatar and points on the right. */
export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cx(
        'flex h-9 items-center gap-2.5 border-b border-line-2 pr-6 pl-4 last:border-b-0',
        className,
      )}
    >
      <Skeleton shape="block" width={14} height={14} />
      <Skeleton width={52} height={10} />
      <Skeleton width="38%" height={10} />
      <span className="ml-auto flex items-center gap-2.5">
        <Skeleton width={64} height={10} />
        <Skeleton shape="circle" width={20} height={20} />
        <Skeleton width={18} height={14} />
      </span>
    </div>
  );
}

/** A board card: title over two lines, then the meta row of glyph, key and avatar. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cx(
        'flex flex-col gap-2 rounded-card bg-card px-2.75 pt-2.5 pb-2.25 shadow-e1',
        className,
      )}
    >
      <Skeleton width="86%" height={11} />
      <Skeleton width="52%" height={11} />
      <span className="flex items-center gap-1.5">
        <Skeleton shape="block" width={14} height={14} />
        <Skeleton width={48} height={10} />
        <Skeleton shape="circle" width={20} height={20} className="ml-auto" />
      </span>
    </div>
  );
}

/** The 52px page header: breadcrumbs on the left, actions on the right. */
export function SkeletonHeader({ tabs = 0, className }: { tabs?: number; className?: string }) {
  return (
    <div
      aria-hidden
      className={cx('flex h-13 items-center gap-2.5 border-b border-line px-6', className)}
    >
      <Skeleton shape="block" width={18} height={18} />
      <Skeleton width={110} height={11} />
      {tabs > 0 && (
        <span className="ml-1.5 flex items-center gap-3 border-l border-line pl-3">
          {Array.from({ length: tabs }, (_, i) => (
            <Skeleton key={i} width={56} height={11} />
          ))}
        </span>
      )}
      <span className="ml-auto flex items-center gap-2">
        <Skeleton shape="block" width={30} height={30} />
        <Skeleton shape="block" width={96} height={30} />
      </span>
    </div>
  );
}
