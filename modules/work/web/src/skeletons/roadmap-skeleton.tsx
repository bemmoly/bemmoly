import { Skeleton } from '@bemmoly/ui';

/*
 * The Roadmap while it loads: the 46px filter row, the 48px date header and rows of the final
 * 44px height, each with its name cell and a bar where bars fall, so nothing shifts when the
 * epics land.
 */

const BARS: ReadonlyArray<[number, number]> = [
  [40, 220],
  [140, 260],
  [10, 300],
  [330, 280],
  [420, 240],
  [210, 180],
];

export function RoadmapSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the roadmap"
      aria-busy
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-canvas"
    >
      <div className="flex h-11.5 shrink-0 items-center gap-2 border-b border-line px-6 max-md:px-4">
        <Skeleton width={180} height={12} />
        <Skeleton width={64} height={26} className="ml-2 rounded-control" />
        <span className="ml-auto flex items-center gap-2">
          <Skeleton width={190} height={24} className="rounded-chip" />
          <Skeleton width={56} height={26} className="rounded-control" />
        </span>
      </div>
      <div className="flex h-12 shrink-0 border-b border-line">
        <div className="flex w-75 shrink-0 items-end border-r border-line px-4 pb-2 max-md:w-33">
          <Skeleton width={110} height={9} />
        </div>
        <div className="flex flex-1 flex-col justify-center gap-2.5 px-3">
          <Skeleton width={260} height={10} />
          <Skeleton width="70%" height={8} />
        </div>
      </div>
      {BARS.map(([left, width], index) => (
        <div key={index} className="flex h-11 shrink-0 border-b border-line-2">
          <div className="flex w-75 shrink-0 items-center gap-2 border-r border-line px-4 max-md:w-33 max-md:px-2">
            <Skeleton width={10} height={10} className="rounded-tick" />
            <span className="flex flex-col gap-1.5">
              <Skeleton width={[140, 110, 160, 120, 96, 130][index]} height={10} />
              <Skeleton width={90} height={8} className="max-md:hidden" />
            </span>
            <Skeleton width={56} height={18} className="ml-auto rounded-chip max-md:hidden" />
          </div>
          <div className="relative flex-1 overflow-hidden">
            <span className="absolute top-2.5" style={{ left }}>
              <Skeleton width={width} height={24} className="rounded-chip" />
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
