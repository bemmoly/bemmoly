import {
  Card,
  DocListRowSkeleton,
  Skeleton,
  SpaceCardSkeleton,
  SpaceSwitcherSkeleton,
} from '@bemmoly/ui';

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
        <div key={index} className="flex items-center gap-2.5 border-b border-br px-3 py-2.5">
          <Skeleton width={16} height={16} className="rounded-sm" />
          <Line width={`${40 + ((index * 17) % 35)}%`} />
          <span className="ml-auto">
            <Line width={64} size="text-12" bar={8} />
          </span>
        </div>
      ))}
    </div>
  );
}

/** The Docs home: the header, a row of space cards, the lists card. */
export function HomeSkeleton() {
  return (
    <div role="status" aria-label="Loading Docs" className="min-h-0 flex-1 overflow-hidden">
      <div className="mx-auto flex max-w-300 flex-col gap-7 px-4 pt-8 sm:px-10">
        <div className="flex flex-col gap-1">
          <Line width={88} size="text-24" bar={18} />
          <Line width={220} size="text-13h" />
        </div>
        <div className="flex flex-col gap-3">
          <Line width={64} size="text-15" bar={12} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <SpaceCardSkeleton key={index} />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Card className="overflow-hidden">
            <span className="flex h-10.5 items-center gap-5 border-b border-br2 px-6.5">
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

/** The space sidebar: the switcher, the search box and a few tree rows. */
function SidebarSkeleton() {
  return (
    <aside className="hidden w-65 shrink-0 flex-col border-r border-br bg-sf md:flex">
      <SpaceSwitcherSkeleton />
      <span className="px-3 pb-2.5">
        <Skeleton height={30} shape="block" />
      </span>
      <span className="flex flex-col gap-px px-2">
        {[62, 48, 70, 55, 40, 66].map((width) => (
          <span key={width} className="flex h-7.5 items-center gap-1.75 pl-2.5">
            <Skeleton width={9} height={9} shape="block" />
            <Skeleton width={`${width}%`} height={10} />
          </span>
        ))}
      </span>
    </aside>
  );
}

/** A space: the sidebar's head, search and tree beside the main column. */
export function SpaceSkeleton() {
  return (
    <div role="status" aria-label="Loading space" className="flex min-h-0 flex-1">
      <SidebarSkeleton />
      <div className="flex min-w-0 flex-1 flex-col gap-4 px-10 pt-8">
        <Line width={200} size="text-24" bar={18} />
        <PageRowsSkeleton label="Loading pages" />
      </div>
    </div>
  );
}

/**
 * A page's main column as the doc editor lays it out: the 44px bar, then the 720px body column
 * with the title, the line about it and paragraphs, and the 340px panel when it is open.
 */
export function PageSkeleton({ panel = false }: { panel?: boolean }) {
  return (
    <div role="status" aria-label="Loading page" className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2.5 border-b border-br bg-sf px-5">
        <Line width={220} size="text-12h" bar={9} />
        <span className="ml-auto flex items-center gap-2">
          <Skeleton width={30} height={30} shape="block" />
          <Skeleton width={30} height={30} shape="block" />
        </span>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-hidden bg-sf">
          <div className="mx-auto flex max-w-180 flex-col gap-4.5 px-4 pt-8 sm:px-10 sm:pt-12">
            <span className="flex h-6.5 items-center gap-1.5">
              <Skeleton width={110} height={26} shape="block" />
              <Skeleton width={130} height={26} shape="block" />
            </span>
            <Line width="55%" size="text-36 leading-display" bar={26} />
            <span className="border-b border-br-row pb-1.5">
              <Line width={260} size="text-12h" bar={9} />
            </span>
            {[100, 96, 62, 100, 88].map((width, index) => (
              <Line key={index} width={`${width}%`} size="text-15h" bar={11} />
            ))}
          </div>
        </div>
        {panel && (
          <div className="hidden w-85 shrink-0 flex-col gap-3 border-l border-br bg-sf xl:flex">
            <span className="flex h-11 items-center gap-5 border-b border-br-row px-6">
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

/** The page screen before its data: the sidebar beside the page's own skeleton. */
export function PageScreenSkeleton({ panel = false }: { panel?: boolean }) {
  return (
    <div className="flex min-h-0 flex-1">
      <SidebarSkeleton />
      <PageSkeleton panel={panel} />
    </div>
  );
}

/** What a Docs screen shows while its own code loads: the same skeleton as its data paint. */
export function ScreenSkeleton({ screen }: { screen: string }) {
  if (screen === 'p') return <PageScreenSkeleton />;
  if (screen === 's') return <SpaceSkeleton />;
  return <HomeSkeleton />;
}
