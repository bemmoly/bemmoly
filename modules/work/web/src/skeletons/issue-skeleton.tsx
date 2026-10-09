import { Skeleton } from '@bemmoly/ui';
import { ControlSkeleton, LineSkeleton } from './parts.tsx';

const DETAIL_VALUES = [96, 88, 72, 16, 92, 104, 92, 48, 80, 40, 84, 118];

/** The Details card: its header bar and label/value rows. */
function DetailsSkeleton({ rows }: { rows: number }) {
  return (
    <div className="overflow-hidden rounded-card border border-br bg-sf">
      <div className="flex items-center border-b border-br2 bg-sf2 px-3.5 py-2.5">
        <LineSkeleton width={52} bar={9} />
      </div>
      <div className="grid grid-cols-[110px_minmax(0,1fr)] px-3.5 py-1.5">
        {DETAIL_VALUES.slice(0, rows).map((width, index) => (
          <div key={index} className="contents">
            <span className="flex h-8.25 items-center">
              <Skeleton width={[64, 60, 48, 76][index % 4]} height={9} />
            </span>
            <span className="flex h-8.25 items-center gap-1.5">
              {index < 2 && <Skeleton width={18} height={18} shape="circle" />}
              <Skeleton width={width} height={9} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A titled section: the 14px heading and a few lines of body text. */
function SectionSkeleton({ lines }: { lines: readonly string[] }) {
  return (
    <div className="flex flex-col gap-2">
      <LineSkeleton width={92} size="text-14" bar={10} />
      <div className="flex flex-col">
        {lines.map((width, index) => (
          <LineSkeleton key={index} width={width} size="text-14 leading-desc" bar={9} />
        ))}
      </div>
    </div>
  );
}

/** The trail, title, action row, summary and description, at the page or panel size. */
function BodySkeleton({ page }: { page: boolean }) {
  return (
    <>
      <LineSkeleton
        width={page ? '58%' : '76%'}
        size={page ? 'text-24 leading-title' : 'text-18 leading-title'}
        bar={page ? 18 : 14}
      />
      <div className="flex gap-1.5">
        <ControlSkeleton width={page ? 130 : 118} height={page ? 32 : 30} />
        <ControlSkeleton width={page ? 116 : 76} height={page ? 32 : 30} />
        <ControlSkeleton width={page ? 84 : 80} height={page ? 32 : 30} />
      </div>
      <Skeleton shape="block" height={page ? 78 : 96} className="rounded-card" />
      <SectionSkeleton lines={page ? ['96%', '62%'] : ['96%', '90%', '48%']} />
      <SectionSkeleton lines={['54%', '42%', '48%']} />
    </>
  );
}

/**
 * The Issue page while the issue loads: the trail and page actions, then the main column and
 * the 360px Details sidebar.
 */
export function IssuePageSkeleton() {
  return (
    <div role="status" aria-label="Loading the issue" aria-busy className="flex flex-col gap-4">
      <div className="flex items-center gap-1.5">
        <LineSkeleton width={260} size="text-13" bar={9} />
        <span className="ml-auto flex gap-1.5">
          <ControlSkeleton width={90} height={30} />
          <ControlSkeleton width={58} height={30} />
          <ControlSkeleton width={30} height={30} />
        </span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-6">
        <div className="flex min-w-0 flex-col gap-5">
          <BodySkeleton page />
        </div>
        <DetailsSkeleton rows={12} />
      </div>
    </div>
  );
}

/** The slide-over's body while its issue loads. */
export function IssuePanelSkeleton() {
  return (
    <div role="status" aria-label="Loading the issue" aria-busy className="flex flex-col gap-4.5">
      <BodySkeleton page={false} />
      <DetailsSkeleton rows={6} />
    </div>
  );
}
