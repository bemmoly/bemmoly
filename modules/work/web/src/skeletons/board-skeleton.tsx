import {
  KanbanCardSkeleton,
  KanbanColumnHeaders,
  kanbanGridStyle,
  Skeleton,
  type KanbanCardSkeletonProps,
} from '@bemmoly/ui';
import { HeaderSkeleton } from './parts.tsx';

/** Cards per column in each placeholder lane, varied so it reads as a board, not a grid. */
const LANES: ReadonlyArray<ReadonlyArray<ReadonlyArray<KanbanCardSkeletonProps>>> = [
  [[{}, { lines: 2 }, {}], [{}, { lines: 2 }], [{}], [{ lines: 2 }], [{}, {}]],
  [[{ lines: 2 }, {}], [{}], [{ lines: 2 }], [{}], [{}]],
];

/**
 * The Board while its view loads: the header, the toolbar row, the column headings and two
 * lanes of cards, each part in the size and place of the loaded one.
 */
export function BoardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the board"
      aria-busy
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex shrink-0 flex-col gap-3 px-6 pt-3.5">
        <HeaderSkeleton subtitle actions={[200, 128, 32]} />
        <div className="flex items-center gap-2 pb-3">
          <Skeleton width={220} height={32} className="rounded-control" />
          <Skeleton width={116} height={32} className="rounded-control" />
          <span className="ml-1 flex">
            {[0, 1, 2, 3, 4].map((index) => (
              <Skeleton
                key={index}
                width={30}
                height={30}
                shape="circle"
                className="-ml-1.5 first:ml-0"
              />
            ))}
          </span>
          {[64, 64, 72].map((width, index) => (
            <Skeleton key={index} width={width} height={32} className="rounded-control" />
          ))}
          <span className="mx-1 h-5 w-px bg-br" />
          {[106, 116, 70].map((width, index) => (
            <Skeleton key={index} width={width} height={28} className="rounded-full" />
          ))}
          <Skeleton width={128} height={32} className="ml-auto rounded-control" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden px-6 pb-6">
        <div className="flex min-w-315 flex-col">
          <KanbanColumnHeaders columns={5}>
            {LANES[0]!.map((_, index) => (
              <span key={index} className="flex h-6 items-center gap-2 px-1.5">
                <Skeleton width={[52, 84, 72, 28, 44][index]} height={9} />
                <Skeleton width={10} height={9} />
              </span>
            ))}
          </KanbanColumnHeaders>
          <div className="flex flex-col gap-2.5">
            {LANES.map((lane, laneIndex) => (
              <section
                key={laneIndex}
                className="overflow-hidden rounded-card border border-br bg-sf"
              >
                <div className="flex items-center gap-2.5 border-b border-br2 bg-bg2 px-3 py-2 text-13">
                  <span className="flex h-[1lh] items-center gap-2.5">
                    <Skeleton width={10} height={10} className="rounded-chip" />
                    <Skeleton width={96} height={10} />
                    <Skeleton width={60} height={9} />
                    <Skeleton width={84} height={9} />
                    <Skeleton width={120} height={6} className="ml-1.5 rounded-full" />
                  </span>
                  <Skeleton width={64} height={9} className="ml-auto" />
                </div>
                <div style={kanbanGridStyle(5)} className="grid gap-3 bg-bg2 p-2.5">
                  {lane.map((cards, column) => (
                    <div key={column} className="flex min-h-11 flex-col gap-2">
                      {cards.map((card, index) => (
                        <KanbanCardSkeleton key={index} {...card} />
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
