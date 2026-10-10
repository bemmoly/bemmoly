import { Card, DocListRowSkeleton, Skeleton } from '@bemmoly/ui';

/** The home's skeleton, on the final grid, so nothing moves when the lists land. */
export function HomeLoading() {
  return (
    <div role="status" aria-label="Loading Docs" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton width={88} height={20} />
        <Skeleton width={240} height={11} />
      </div>
      <div className="flex flex-col gap-2.5">
        <Skeleton width={96} height={11} />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} height={98} className="rounded-card" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <span className="flex h-12 items-center border-b border-br2 px-3.5">
            <Skeleton width={320} height={24} />
          </span>
          <DocListRowSkeleton rows={6} />
        </Card>
        <Card className="overflow-hidden">
          <span className="flex h-11 items-center border-b border-br2 px-3.5">
            <Skeleton width={64} height={11} />
          </span>
          <DocListRowSkeleton rows={4} />
        </Card>
      </div>
    </div>
  );
}
