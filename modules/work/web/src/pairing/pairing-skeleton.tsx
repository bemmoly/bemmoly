import { Skeleton } from '@bemmoly/ui';

/** The matrix while it loads: the toolbar's height, then rows of grey cells of the final size. */
export function PairingSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the pairing matrix"
      aria-busy
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden bg-canvas px-6 py-4 max-md:px-4"
    >
      <Skeleton width={220} height={28} className="rounded-control" />
      {Array.from({ length: 5 }, (_, row) => (
        <div key={row} className="flex items-center gap-0.5">
          <Skeleton width={140} height={12} className="mr-3" />
          {Array.from({ length: 5 }, (_, col) => (
            <Skeleton key={col} width={40} height={40} className="rounded-chip" />
          ))}
        </div>
      ))}
    </div>
  );
}
