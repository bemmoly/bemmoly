import { BacklogRowSkeleton, Skeleton } from '@bemmoly/ui';
import { LineSkeleton } from './parts.tsx';

/** A sprint or the backlog: the header bar, its rows and the "+ Create issue" line. */
function ContainerSkeleton({ rows, active }: { rows: number; active?: boolean }) {
  return (
    <section
      className={`mt-4 overflow-hidden rounded-card border bg-sf ${active ? 'border-ac-br' : 'border-br'}`}
    >
      <div className="flex items-center gap-2.5 border-b border-br-row bg-sf2 px-3.5 py-2.5 text-13">
        <span className="flex h-7 items-center gap-2.5">
          <Skeleton width={10} height={10} className="rounded-chip" />
          <Skeleton width={96} height={10} />
          <Skeleton width={80} height={9} />
          {active && <Skeleton width={48} height={18} className="rounded-xs" />}
          <Skeleton width={56} height={9} />
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} width={20} height={17} className="rounded-pill" />
          ))}
          <Skeleton width={84} height={9} className="ml-1.5" />
          <Skeleton width={110} height={28} className="ml-2 rounded-sm" />
        </span>
      </div>
      {Array.from({ length: rows }, (_, index) => (
        <BacklogRowSkeleton key={index} index={index} />
      ))}
      <div className="py-2.25 pr-3.5 pl-12.5">
        <LineSkeleton width={84} size="text-12h" bar={8} />
      </div>
    </section>
  );
}

/** The sprint list while the backlog loads: the active sprint, then the backlog. */
export function BacklogContainersSkeleton() {
  return (
    <div role="status" aria-label="Loading the backlog" aria-busy>
      <ContainerSkeleton rows={7} active />
      <ContainerSkeleton rows={4} />
    </div>
  );
}

/** The epics panel's items while the backlog loads. */
export function EpicsSkeleton() {
  return (
    <div aria-hidden className="flex flex-col">
      {[96, 72, 110].map((width, index) => (
        <div
          key={index}
          className="flex flex-col gap-1.5 border-b border-br-row px-3.5 py-2.5 text-13"
        >
          <span className="flex h-[1lh] items-center gap-2">
            <Skeleton width={10} height={10} className="rounded-chip" />
            <Skeleton width={width} height={10} />
            <Skeleton width={48} height={9} className="ml-auto" />
          </span>
          <span className="flex h-[1lh] items-center gap-2 text-12">
            <Skeleton width="auto" height={6} className="flex-1 shrink rounded-full" />
            <Skeleton width={28} height={9} />
          </span>
          <LineSkeleton width={92} size="text-12" bar={8} />
        </div>
      ))}
    </div>
  );
}
