import { Skeleton } from '@bemmoly/ui';

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

/** The Docs home: header, a row of space cards, the recent list. */
export function HomeSkeleton() {
  return (
    <div className="min-h-0 flex-1 overflow-hidden">
      <div className="mx-auto flex max-w-310 flex-col gap-6 px-10 pt-5">
        <Line width={120} size="text-22" bar={14} />
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} height={88} className="rounded-card" />
          ))}
        </div>
        <PageRowsSkeleton label="Loading recent pages" />
      </div>
    </div>
  );
}

/** A space: the tree sidebar beside the space's page list. */
export function SpaceSkeleton() {
  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-65 shrink-0 flex-col gap-2 border-r border-br px-3 pt-4">
        {Array.from({ length: 8 }, (_, index) => (
          <Line key={index} width={`${50 + ((index * 13) % 40)}%`} />
        ))}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col gap-4 px-10 pt-5">
        <Line width={160} size="text-22" bar={14} />
        <PageRowsSkeleton label="Loading pages" />
      </div>
    </div>
  );
}

/** A page: breadcrumbs, title, then paragraphs of the document column. */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading page" className="min-h-0 flex-1 overflow-hidden">
      <div className="mx-auto flex max-w-180 flex-col gap-3 px-10 pt-5">
        <Line width={180} size="text-12" bar={8} />
        <Line width="55%" size="text-26" bar={20} />
        {Array.from({ length: 6 }, (_, index) => (
          <Line key={index} width={index % 3 === 2 ? '60%' : '100%'} size="text-15" />
        ))}
      </div>
    </div>
  );
}

/** What a Docs screen shows while its own code loads: the same skeleton as its data paint. */
export function ScreenSkeleton({ screen }: { screen: string }) {
  if (screen === 's') return <SpaceSkeleton />;
  if (screen === 'p') return <PageSkeleton />;
  return <HomeSkeleton />;
}
