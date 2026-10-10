import { IssueRowSkeleton, Skeleton } from '@bemmoly/ui';

/** A sprint or the backlog: the 36px header, its rows and the "Create issue" line. */
function ContainerSkeleton({ rows, active }: { rows: number; active?: boolean }) {
  return (
    <section className="-mt-px">
      <div className="flex h-9 items-center gap-2 border-y border-line bg-sunken pr-6 pl-4">
        <Skeleton width={14} height={14} />
        <Skeleton width={15} height={15} shape="circle" />
        <Skeleton width={96} height={10} />
        {active && <Skeleton width={44} height={18} className="rounded-chip" />}
        <Skeleton width={110} height={9} />
        <span className="ml-auto flex items-center gap-2.5">
          {active && <Skeleton width={90} height={4} className="rounded-[2px]" />}
          <Skeleton width={64} height={9} />
          <Skeleton width={72} height={28} className="rounded-chip" />
        </span>
      </div>
      {Array.from({ length: rows }, (_, index) => (
        <IssueRowSkeleton key={index} index={index} />
      ))}
      <div className="flex h-9 items-center gap-2 border-b border-line-2 pr-6 pl-4">
        <Skeleton width={14} height={14} />
        <Skeleton width={84} height={9} />
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

/** The epics rail's items while the backlog loads. */
export function EpicsSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-1">
      {[96, 72, 110].map((width, index) => (
        <div key={index} className="flex flex-col gap-2 px-3 py-2.5">
          <span className="flex h-[1lh] items-center gap-2 text-13">
            <Skeleton width={10} height={10} className="rounded-[3px]" />
            <Skeleton width={width} height={10} />
            <Skeleton width={24} height={9} className="ml-auto" />
          </span>
          <Skeleton width="auto" height={4} className="w-full rounded-[2px]" />
        </div>
      ))}
    </div>
  );
}
