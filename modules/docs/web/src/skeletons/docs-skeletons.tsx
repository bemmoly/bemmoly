import { Card, DocListRowSkeleton, Skeleton, SpaceCardSkeleton } from '@bemmoly/ui';

/*
 * Loading states of the Docs screens. Each bar sits in a line box of the text
 * it stands for, so a skeleton is as tall as what replaces it and the data
 * paint does not shift the page.
 */

function Line({
  width,
  size = 'text-13',
  bar = 10,
}: {
  width: string | number;
  size?: string;
  bar?: number;
}) {
  return (
    <span className={`flex h-[1lh] shrink-0 items-center ${size}`}>
      <Skeleton width={width} height={bar} />
    </span>
  );
}

/** A list of page rows: icon, title, meta. */
export function PageRowsSkeleton({ rows = 5, label }: { rows?: number; label: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-2.5 border-b border-line px-3 py-2.5">
          <Skeleton width={16} height={16} className="rounded-chip" />
          <Line width={`${40 + ((index * 17) % 35)}%`} />
          <span className="ml-auto">
            <Line width={64} size="text-12" bar={8} />
          </span>
        </div>
      ))}
    </div>
  );
}

/** The Docs home in its contained column: the title, a row of space cards, the lists card. */
export function HomeSkeleton() {
  return (
    <div role="status" aria-label="Loading Docs">
      <div className="flex flex-col gap-7">
        <div className="flex flex-col gap-1">
          <Line width={88} size="text-24" bar={18} />
          <Line width={220} size="text-13" />
        </div>
        <div className="flex flex-col gap-3">
          <Line width={64} size="text-16" bar={12} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <SpaceCardSkeleton key={index} />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Card className="overflow-hidden">
            <span className="flex h-10.5 items-center gap-5 border-b border-line-2 px-6.5">
              <Skeleton width={48} height={10} />
              <Skeleton width={48} height={10} />
              <Skeleton width={40} height={10} />
            </span>
            <DocListRowSkeleton rows={5} />
          </Card>
        </div>
      </div>
    </div>
  );
}

/** A space's overview in its contained column: the title, then its pages. */
export function SpaceSkeleton() {
  return (
    <div role="status" aria-label="Loading space" className="flex flex-col gap-4">
      <Line width={200} size="text-24" bar={18} />
      <PageRowsSkeleton label="Loading pages" />
    </div>
  );
}

/**
 * A page under the frame's header as the doc editor lays it out: the body column with the
 * title, the line about it and paragraphs, and the 340px panel when it is open.
 */
export function PageSkeleton({ panel = false }: { panel?: boolean }) {
  return (
    <div role="status" aria-label="Loading page" className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-hidden bg-sf">
          <div className="mx-auto flex max-w-195 flex-col gap-4.5 px-4 pt-8 sm:px-10 sm:pt-12">
            <span className="flex h-6.5 items-center gap-1.5">
              <Skeleton width={110} height={26} shape="block" />
              <Skeleton width={130} height={26} shape="block" />
            </span>
            <Line width="55%" size="text-24 leading-display" bar={26} />
            <span className="border-b border-line-2 pb-1.5">
              <Line width={260} size="text-13" bar={9} />
            </span>
            {[100, 96, 62, 100, 88].map((width, index) => (
              <Line key={index} width={`${width}%`} size="text-16" bar={11} />
            ))}
          </div>
        </div>
        {panel && (
          <div className="hidden w-85 shrink-0 flex-col gap-3 border-l border-line bg-card xl:flex">
            <span className="flex h-11 items-center gap-5 border-b border-line-2 px-6">
              <Skeleton width={44} height={10} />
              <Skeleton width={64} height={10} />
            </span>
            <span className="flex flex-col gap-3 px-3.5">
              <Skeleton width={110} height={8} />
              <Skeleton height={220} shape="block" />
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/** What a Docs screen shows while its own code loads: the same skeleton as its data paint. */
export function ScreenSkeleton({ screen }: { screen: string }) {
  if (screen === 'p') return <PageSkeleton />;
  if (screen === 's') return <SpaceSkeleton />;
  return <HomeSkeleton />;
}
