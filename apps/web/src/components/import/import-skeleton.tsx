import { Skeleton } from '@bemmoly/ui';

/** Settings › Import while it loads: the source cards, then the recent imports panel. */
export function ImportSkeleton() {
  return (
    <div role="status" aria-label="Loading import" aria-busy className="flex flex-col gap-6">
      <div aria-hidden className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2].map((card) => (
          <div key={card} className="flex flex-col gap-3 rounded-card bg-card p-4 shadow-e1">
            <div className="flex items-center gap-2.5">
              <Skeleton width={32} height={32} />
              <Skeleton width={110} height={10} />
            </div>
            <Skeleton width="85%" height={9} />
          </div>
        ))}
      </div>
      <div aria-hidden className="flex flex-col gap-3 rounded-card bg-card p-4 shadow-e1">
        <Skeleton width={120} height={10} />
        <Skeleton width="70%" height={9} />
        <Skeleton width="55%" height={9} />
      </div>
    </div>
  );
}
