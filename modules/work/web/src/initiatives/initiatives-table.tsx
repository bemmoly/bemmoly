import type { Initiative } from '@bemmoly/module-work/shared';
import { ProgressBar, Table, type TableColumn } from '@bemmoly/ui';
import type { ReactNode } from 'react';
import { percentDone } from '../hooks/initiatives.ts';

/** The track widths, shared with the loading skeleton so nothing shifts when rows land. */
export const INITIATIVE_TRACKS = {
  name: 'minmax(0,2fr)',
  epics: '96px',
  progress: '170px',
  target: '110px',
  projects: '88px',
  menu: '28px',
};

const longDate = (iso: string | null) =>
  iso
    ? new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : 'No target';

export interface InitiativesTableProps {
  rows: readonly Initiative[];
  onOpen: (initiative: Initiative) => void;
  menu: (initiative: Initiative) => ReactNode;
  empty: ReactNode;
}

/** Initiatives: name and purpose, epics done, issues done, target, projects, actions. */
export function InitiativesTable({ rows, onOpen, menu, empty }: InitiativesTableProps) {
  const columns: TableColumn<Initiative>[] = [
    {
      key: 'name',
      header: 'Initiative',
      width: INITIATIVE_TRACKS.name,
      render: (initiative) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-semibold text-tx">{initiative.name}</span>
          {initiative.description && (
            <span className="truncate text-12 text-tx-3">{initiative.description}</span>
          )}
        </span>
      ),
    },
    {
      key: 'epics',
      header: 'Epics',
      width: INITIATIVE_TRACKS.epics,
      render: ({ epics }) => (
        <span className="text-12 text-tx-2 tabular-nums">
          {epics.done} of {epics.total} done
        </span>
      ),
    },
    {
      key: 'progress',
      header: 'Progress',
      width: INITIATIVE_TRACKS.progress,
      hideOnPhone: true,
      render: (initiative) => (
        <span
          className="flex min-w-0 items-center gap-2"
          title={`${initiative.progress.done} of ${initiative.progress.total} issues done`}
        >
          <ProgressBar
            value={percentDone(initiative)}
            size="xs"
            fillClassName="bg-done"
            className="w-16"
            label={`${initiative.name} progress`}
          />
          <span className="text-12 text-tx-3 tabular-nums">{percentDone(initiative)}%</span>
        </span>
      ),
    },
    {
      key: 'target',
      header: 'Target',
      width: INITIATIVE_TRACKS.target,
      hideOnPhone: true,
      render: (initiative) => (
        <span className="text-12 text-tx-3 tabular-nums">{longDate(initiative.targetAt)}</span>
      ),
    },
    {
      key: 'projects',
      header: 'Projects',
      width: INITIATIVE_TRACKS.projects,
      hideOnPhone: true,
      render: (initiative) => (
        <span className="text-12 text-tx-3 tabular-nums">{initiative.projectIds.length}</span>
      ),
    },
    {
      key: 'menu',
      header: <span className="sr-only">Actions</span>,
      width: INITIATIVE_TRACKS.menu,
      align: 'center',
      render: menu,
    },
  ];
  return (
    <Table<Initiative>
      label="Initiatives"
      rows={rows}
      rowKey={(initiative) => initiative.id}
      columns={columns}
      isMuted={(initiative) => initiative.archivedAt !== null}
      onRowClick={onOpen}
      empty={empty}
    />
  );
}

export { longDate };
