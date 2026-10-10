import type { Project } from '@bemmoly/module-work/shared';
import type { Team } from '@bemmoly/shared';
import { RelativeTime, Table, type TableColumn, type TableSort } from '@bemmoly/ui';
import type { ReactNode } from 'react';
import {
  KeyCell,
  LeadCell,
  MethodCell,
  ProjectIdentity,
  StarButton,
  TeamCell,
} from './project-cells.tsx';
import { ProjectProgress } from './project-progress.tsx';

export interface ProjectRowActions {
  isStarred: (key: string) => boolean;
  toggleStar: (key: string) => void;
  teamOf: (project: Project) => Team | undefined;
  leadOf: (team: Team | undefined) => { id: string | null; name: string | null };
  menu: (project: Project) => ReactNode;
  open: (project: Project) => void;
}

/** The track widths, shared with the loading skeleton so nothing shifts when rows land. */
export const PROJECT_TRACKS = {
  star: '28px',
  project: 'minmax(0,2fr)',
  key: '64px',
  lead: 'minmax(0,1fr)',
  team: '120px',
  method: '92px',
  progress: '170px',
  updated: '96px',
  menu: '28px',
};

/** Projects as the review's table: star, identity, key, lead, team, method, progress, updated. */
export function ProjectsTable({
  rows,
  sort,
  onSort,
  actions,
  empty,
}: {
  rows: readonly Project[];
  sort: TableSort;
  onSort: (sort: TableSort) => void;
  actions: ProjectRowActions;
  empty: ReactNode;
}) {
  const columns: TableColumn<Project>[] = [
    {
      key: 'star',
      header: <span className="sr-only">Starred</span>,
      width: PROJECT_TRACKS.star,
      render: (project) =>
        project.archivedAt ? null : (
          <StarButton
            project={project}
            starred={actions.isStarred(project.key)}
            onToggle={() => actions.toggleStar(project.key)}
          />
        ),
    },
    {
      key: 'name',
      header: 'Project',
      width: PROJECT_TRACKS.project,
      sortable: true,
      render: (project) => <ProjectIdentity project={project} team={actions.teamOf(project)} />,
    },
    {
      key: 'key',
      header: 'Key',
      width: PROJECT_TRACKS.key,
      sortable: true,
      hideOnPhone: true,
      render: (project) => <KeyCell project={project} />,
    },
    {
      key: 'lead',
      header: 'Lead',
      width: PROJECT_TRACKS.lead,
      hideOnPhone: true,
      render: (project) => <LeadCell {...actions.leadOf(actions.teamOf(project))} />,
    },
    {
      key: 'team',
      header: 'Team',
      width: PROJECT_TRACKS.team,
      hideOnPhone: true,
      render: (project) => <TeamCell team={actions.teamOf(project)} />,
    },
    {
      key: 'method',
      header: 'Method',
      width: PROJECT_TRACKS.method,
      hideOnPhone: true,
      render: (project) => <MethodCell method={project.method} />,
    },
    {
      key: 'progress',
      header: 'Progress',
      width: PROJECT_TRACKS.progress,
      hideOnPhone: true,
      render: (project) => <ProjectProgress project={project} />,
    },
    {
      key: 'updated',
      header: 'Updated',
      width: PROJECT_TRACKS.updated,
      sortable: true,
      hideOnPhone: true,
      render: (project) => (
        <RelativeTime iso={project.updatedAt} className="text-12 text-tx-3 tabular-nums" />
      ),
    },
    {
      key: 'menu',
      header: <span className="sr-only">Actions</span>,
      width: PROJECT_TRACKS.menu,
      align: 'center',
      render: actions.menu,
    },
  ];
  return (
    <Table<Project>
      label="Projects"
      rows={rows}
      rowKey={(project) => project.id}
      columns={columns}
      sort={sort}
      onSort={onSort}
      isMuted={(project) => project.archivedAt !== null}
      onRowClick={actions.open}
      onRowContextMenu={(_, event) => {
        const trigger = (event.currentTarget as HTMLElement).querySelector<HTMLElement>(
          '[data-row-menu]',
        );
        if (!trigger) return;
        event.preventDefault();
        trigger.click();
      }}
      empty={empty}
    />
  );
}
