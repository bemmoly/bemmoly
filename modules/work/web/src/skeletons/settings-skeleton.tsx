import { Skeleton, TableSkeleton } from '@bemmoly/ui';
import { ControlSkeleton, HeaderSkeleton, LineSkeleton } from './parts.tsx';

/** One column card of the Columns tab: grip and name, the WIP row, two status chips. */
function ColumnCardSkeleton({ statuses }: { statuses: number }) {
  return (
    <div className="flex min-h-64.5 flex-col rounded-card border border-line bg-card">
      <div className="flex flex-col gap-2 border-b border-line-2 px-2.5 py-2.5">
        <LineSkeleton width={64} bar={9} />
        <span className="flex items-center gap-2">
          <Skeleton width={48} height={9} />
          <ControlSkeleton width={40} height={22} />
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2">
        {Array.from({ length: statuses }, (_, index) => (
          <ControlSkeleton key={index} width="100%" height={32} />
        ))}
        <Skeleton width="100%" height={32} className="mt-auto rounded-control opacity-60" />
      </div>
    </div>
  );
}

/**
 * Board settings while the settings load: the page header and description, the "Inherits
 * from" banner, the tab row and the Columns tab's section head and column cards.
 */
export function BoardSettingsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading board settings"
      aria-busy
      className="flex flex-col gap-6"
    >
      <HeaderSkeleton actions={[142]} description gap="gap-1.5" />
      <Skeleton shape="block" height={52} className="rounded-card" />
      <div className="flex gap-6 border-b border-line pb-3">
        {[56, 76, 76, 40, 150].map((width, index) => (
          <LineSkeleton key={index} width={width} size="text-13" bar={9} />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-start">
          <div className="flex flex-col gap-2">
            <LineSkeleton width={80} size="text-16" bar={11} />
            <LineSkeleton width={480} bar={9} />
          </div>
          <ControlSkeleton width={70} className="ml-auto" />
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[2, 1, 2, 1].map((statuses, index) => (
            <ColumnCardSkeleton key={index} statuses={statuses} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** The preview rail beside Board settings: its header bar and a sketch of two lanes. */
export function PreviewRailSkeleton() {
  return (
    <div aria-hidden className="flex min-h-0 w-85 shrink-0 flex-col border-l border-line bg-card">
      <div className="flex items-center gap-2 border-b border-line-2 px-4 py-3">
        <LineSkeleton width={56} bar={9} />
        <Skeleton width={90} height={8} />
        <Skeleton width={64} height={9} className="ml-auto" />
      </div>
      <div className="flex flex-col gap-3 p-3.5">
        <Skeleton width="100%" height={8} />
        <Skeleton width="100%" height={96} className="rounded-card" />
        <Skeleton width="100%" height={96} className="rounded-card" />
      </div>
    </div>
  );
}

/** A settings list page (Issue types, Fields, Workflows): its rows in the Table's card. */
export function SettingsListSkeleton({ label, tracks }: { label: string; tracks: string[] }) {
  return <TableSkeleton label={label} rows={3} columns={tracks.map((width) => ({ width }))} />;
}

const NODES = [
  { left: 0, top: 0 },
  { left: 220, top: 0 },
  { left: 440, top: 0 },
  { left: 660, top: 0 },
  { left: 220, top: 140 },
  { left: 440, top: 140 },
];

/**
 * The workflow editor while the workflow and its draft load: the header with its three
 * actions, status nodes on the canvas and the 340px side panel.
 */
export function WorkflowEditorSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the workflow"
      aria-busy
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex shrink-0 flex-col gap-3 px-6 pt-3.5 pb-3">
        <LineSkeleton width={280} size="text-13" bar={9} />
        <div className="flex items-center gap-4">
          <LineSkeleton width={190} size="text-20" bar={16} />
          <Skeleton width={96} height={18} className="rounded-chip" />
          <Skeleton width={260} height={9} />
          <span className="ml-auto flex gap-2">
            <ControlSkeleton width={78} />
            <ControlSkeleton width={92} />
            <ControlSkeleton width={72} />
          </span>
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1 overflow-hidden px-6 pt-10">
          {NODES.map((node, index) => (
            <span
              key={index}
              className="absolute"
              style={{ left: 64 + node.left, top: 40 + node.top }}
            >
              <Skeleton width={150} height={56} className="rounded-card" />
            </span>
          ))}
        </div>
        <div className="flex w-85 shrink-0 flex-col gap-4 border-l border-line bg-card px-4 py-3.5">
          <LineSkeleton width={140} size="text-14" bar={10} />
          <Skeleton width="80%" height={9} />
          <Skeleton width="64%" height={9} />
          <Skeleton width="72%" height={9} />
        </div>
      </div>
    </div>
  );
}
