import { TableSkeleton } from '@bemmoly/ui';
import { BoardSkeleton } from './board-skeleton.tsx';
import { IssuePageSkeleton } from './issue-skeleton.tsx';
import { HeaderSkeleton } from './parts.tsx';

/** A centred list page (projects, members): its header and a table of rows. */
function ListPageSkeleton({ label }: { label: string }) {
  return (
    <div className="min-h-0 flex-1 overflow-hidden">
      <div className="mx-auto flex max-w-310 flex-col gap-4 px-10 pt-5">
        <HeaderSkeleton subtitle actions={[124]} />
        <TableSkeleton
          label={label}
          rows={3}
          columns={[{ width: '90px' }, { width: 'minmax(0,1.6fr)' }, { width: 'minmax(0,1fr)' }]}
        />
      </div>
    </div>
  );
}

/**
 * What a Work screen shows while its own code loads, before it can draw its data skeleton:
 * the same skeleton, so the first paint and the data paint line up. Screens framed by a
 * sidebar draw their frame at once and show nothing here.
 */
export function ScreenSkeleton({ screen }: { screen: string }) {
  if (screen === 'board') return <BoardSkeleton />;
  if (screen === 'issue')
    return (
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="mx-auto flex max-w-310 flex-col px-10 pt-5">
          <IssuePageSkeleton />
        </div>
      </div>
    );
  if (screen === 'projects' || screen === 'create')
    return <ListPageSkeleton label="Loading projects" />;
  if (screen === 'members') return <ListPageSkeleton label="Loading members" />;
  return null;
}
