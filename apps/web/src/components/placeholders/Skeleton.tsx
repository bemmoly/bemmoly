/** PLACEHOLDER for @bemmoly/ui Skeleton: grey bars while a query loads. */
export function Skeleton({ rows = 3, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-2.5 p-4">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="h-3.5 animate-pulse rounded-tag bg-chip"
          style={{ width: `${90 - index * 12}%` }}
        />
      ))}
    </div>
  );
}
