import { Skeleton } from '@bemmoly/ui';
import { ControlSkeleton, LineSkeleton } from './parts.tsx';

/** The Issue page's two columns: the reading column and the 300px rail, 40px apart. */
export const ISSUE_GRID =
  'grid grid-cols-1 items-start gap-8 md:grid-cols-[minmax(0,1fr)_300px] md:gap-10';

const VALUES = [
  [96, 120, 64, 88],
  [92, 104, 80, 72],
  [96, 84],
] as const;

/** The rail: the status button, its next transitions, then the three property groups. */
function RailSkeleton() {
  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-2 pb-3.5">
        <ControlSkeleton width="100%" height={32} />
        <span className="flex gap-1.5">
          <ControlSkeleton width={92} height={28} />
          <ControlSkeleton width={64} height={28} />
        </span>
      </div>
      {VALUES.map((group, g) => (
        <div key={g} className="flex flex-col border-t border-line py-3.5">
          <LineSkeleton width={64} size="text-11" bar={8} />
          {group.map((width, index) => (
            <div key={index} className="grid h-8 grid-cols-[96px_minmax(0,1fr)] items-center gap-2">
              <Skeleton width={[56, 48, 60, 52][index % 4]} height={9} />
              <span className="flex items-center gap-1.75">
                {g !== 1 && index === 1 && <Skeleton width={20} height={20} shape="circle" />}
                <Skeleton width={width} height={9} />
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** The title, the three ghost actions, the description, criteria and the first section. */
function BodySkeleton({ page }: { page: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2.5">
        <LineSkeleton
          width={page ? '62%' : '76%'}
          size={page ? 'text-24 leading-title' : 'text-18 leading-title'}
          bar={page ? 18 : 14}
        />
        <span className="flex gap-1">
          <ControlSkeleton width={104} height={28} />
          <ControlSkeleton width={56} height={28} />
          <ControlSkeleton width={64} height={28} />
        </span>
      </div>
      <div className="flex flex-col">
        {['96%', '88%', '54%'].map((width, index) => (
          <LineSkeleton key={index} width={width} size="text-14 leading-desc" bar={9} />
        ))}
      </div>
      <Skeleton shape="block" height={86} className="rounded-card" />
      <div className="flex flex-col gap-2">
        <LineSkeleton width={84} size="text-14" bar={10} />
        <Skeleton shape="block" height={108} className="rounded-card" />
      </div>
    </div>
  );
}

/** The Issue page while the issue loads: the reading column beside the rail. */
export function IssuePageSkeleton() {
  return (
    <div role="status" aria-label="Loading the issue" aria-busy className={ISSUE_GRID}>
      <BodySkeleton page />
      <div className="hidden md:block">
        <RailSkeleton />
      </div>
    </div>
  );
}

/** The peek's body while its issue loads. */
export function IssuePanelSkeleton() {
  return (
    <div role="status" aria-label="Loading the issue" aria-busy className="flex flex-col gap-4.5">
      <BodySkeleton page={false} />
    </div>
  );
}
