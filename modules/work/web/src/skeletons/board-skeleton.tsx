import {
  IssueCardSkeleton,
  KanbanColumnHeaders,
  kanbanGridStyle,
  Skeleton,
  type IssueCardSkeletonProps,
} from '@bemmoly/ui';

/** Cards per column in each placeholder lane, varied so it reads as a board, not a grid. */
const LANES: ReadonlyArray<ReadonlyArray<ReadonlyArray<IssueCardSkeletonProps>>> = [
  [[{}, { lines: 2 }, {}], [{}, { lines: 2 }], [{}], [{ lines: 2 }], [{}, {}]],
  [[{ lines: 2 }, {}], [{}], [{ lines: 2 }], [{}], [{}]],
];

/** The sprint strip and the filter row, each in the size and place of the loaded one. */
function StripSkeleton() {
  return (
    <>
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-6 max-md:px-4">
        <Skeleton width={18} height={18} shape="circle" />
        <span className="flex flex-col gap-1.5">
          <Skeleton width={120} height={12} />
          <Skeleton width={220} height={9} />
        </span>
        <span className="ml-auto flex items-center gap-3.5 max-md:hidden">
          <Skeleton width={160} height={20} />
          <Skeleton width={128} height={32} className="rounded-control" />
        </span>
      </div>
      <div className="flex h-11.5 shrink-0 items-center gap-2 border-b border-line px-6 max-md:px-4">
        <Skeleton width={200} height={26} className="rounded-panel" />
        <Skeleton width={72} height={26} className="rounded-panel" />
        <Skeleton width={104} height={26} className="rounded-panel" />
        <Skeleton width={160} height={26} className="ml-auto rounded-card max-md:hidden" />
      </div>
    </>
  );
}

/**
 * The Board while its view loads: the strip, the filter row, the column headings and two
 * lanes of cards, so nothing moves when the data lands.
 */
export function BoardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the board"
      aria-busy
      className="flex min-h-0 flex-1 flex-col"
    >
      <StripSkeleton />
      <div className="min-h-0 flex-1 overflow-hidden bg-sunken px-6 pb-6 max-md:px-4">
        <div className="flex min-w-240 flex-col max-md:min-w-0">
          <KanbanColumnHeaders columns={5}>
            {LANES[0]!.map((_, index) => (
              <span key={index} className="flex h-8 items-center gap-2 px-1">
                <Skeleton width={14} height={14} shape="circle" />
                <Skeleton width={[52, 84, 72, 28, 44][index]} height={10} />
              </span>
            ))}
          </KanbanColumnHeaders>
          {LANES.map((lane, laneIndex) => (
            <section key={laneIndex} className="mt-2">
              <div className="flex h-8.5 items-center gap-2 px-1">
                <Skeleton width={10} height={10} className="rounded-[3px]" />
                <Skeleton width={96} height={10} />
                <Skeleton width={84} height={9} />
                <Skeleton width={90} height={4} className="rounded-[2px]" />
              </div>
              <div style={kanbanGridStyle(5)} className="grid gap-2.5">
                {lane.map((cards, column) => (
                  <div key={column} className="flex min-h-11 flex-col gap-2 pt-0.5 pb-2">
                    {cards.map((card, index) => (
                      <IssueCardSkeleton key={index} {...card} />
                    ))}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
