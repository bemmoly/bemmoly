import type { Project } from '@bemmoly/module-work/shared';
import type { Team } from '@bemmoly/shared';
import { HeaderActions, navigateInApp, openCreate, withCreate } from '@bemmoly/core-web';
import { Button, EmptyState, TableSkeleton } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useEffect } from 'react';
import { navigateTo, workPaths } from '../hooks/issue-navigation.ts';
import { usePeople } from '../hooks/issue-people.ts';
import { useSettingsAccess } from '../hooks/settings-access.ts';
import type { WorkScreenProps } from '../routes.tsx';
import { MenuCell, TwoLineCell } from '../skeletons/table-cells.tsx';
import { projectPaths } from './project-paths.ts';
import { ProjectRowMenu } from './project-row-menu.tsx';
import { useProjectStars } from './project-stars.ts';
import { useProjectsData } from './projects-data.ts';
import { ProjectsGrid } from './projects-grid.tsx';
import { PROJECT_TRACKS, ProjectsTable, type ProjectRowActions } from './projects-table.tsx';
import { ProjectsToolbar } from './projects-toolbar.tsx';
import { useProjectsView, viewRows, type ProjectsViewState } from './projects-view.ts';

const SKELETON = Object.values(PROJECT_TRACKS).map((width, index) =>
  index === 1
    ? { width, cell: <TwoLineCell width="40%" second="60%" avatar={28} /> }
    : index === 8
      ? { width, align: 'center' as const, cell: <MenuCell /> }
      : { width },
);

/** What an empty list says depends on why it is empty. */
function EmptyProjects({
  view,
  onCreate,
  onClear,
}: {
  view: ProjectsViewState;
  onCreate?: (() => void) | undefined;
  onClear: () => void;
}) {
  if (view.q.trim())
    return (
      <EmptyState
        icon={<Icon name="search" />}
        title={`No projects match “${view.q.trim()}”`}
        description="Search looks at names, keys and descriptions."
        action={<Button onClick={onClear}>Clear search</Button>}
      />
    );
  if (view.segment === 'starred')
    return (
      <EmptyState
        icon={<Icon name="star" />}
        title="No starred projects"
        description="Star the projects you open most; they lead the sidebar."
      />
    );
  if (view.segment === 'archived')
    return (
      <EmptyState
        icon={<Icon name="archive" />}
        title="Nothing archived"
        description="Archived projects keep their issues and can be restored here."
      />
    );
  return (
    <EmptyState
      icon={<Icon name="project" />}
      title="No projects yet"
      description="A project holds issues under one key, with its own board and backlog."
      {...(onCreate
        ? {
            action: (
              <Button variant="primary" onClick={onCreate}>
                New project
              </Button>
            ),
          }
        : {})}
    />
  );
}

/**
 * All projects at /work/projects, as a table or a grid. New project opens its dialog over this
 * page; the old /work/projects/new address becomes that. A row opens the project's board.
 */
export default function ProjectsScreen({ projectKey: segment }: WorkScreenProps) {
  const legacyNew = segment === 'new';
  const data = useProjectsData();
  const stars = useProjectStars();
  const { view, update } = useProjectsView();
  const { person } = usePeople();
  const access = useSettingsAccess();
  const create = () => openCreate('work.create-project');

  const active = data.projects.filter((project) => project.archivedAt === null);
  const counts = {
    all: active.length,
    starred: active.filter((project) => stars.isStarred(project.key)).length,
    archived: data.projects.length - active.length,
  };
  const rows = viewRows(data.projects, view, stars.isStarred);
  const actions: ProjectRowActions = {
    isStarred: stars.isStarred,
    toggleStar: stars.toggle,
    teamOf: data.teamOf,
    leadOf: (team: Team | undefined) => {
      const id = team?.leadUserId ?? null;
      return { id, name: id ? person(id).name : null };
    },
    open: (project: Project) =>
      project.archivedAt === null
        ? navigateTo(workPaths.board(project.key))
        : navigateTo(projectPaths.settings(project.key)),
    menu: (project: Project) => (
      <ProjectRowMenu
        project={project}
        starred={stars.isStarred(project.key)}
        canArchive={access.configureProject}
        onStar={() => stars.toggle(project.key)}
        onArchive={() => data.toggleArchive(project)}
      />
    ),
  };
  const empty = <EmptyProjects view={view} onCreate={create} onClear={() => update({ q: '' })} />;

  useEffect(() => {
    if (legacyNew)
      navigateInApp(withCreate(workPaths.projects(), 'work.create-project'), { replace: true });
  }, [legacyNew]);

  return (
    <>
      <HeaderActions>
        <Button variant="primary" icon={<Icon name="plus" size={14} />} onClick={create}>
          New project
        </Button>
      </HeaderActions>
      <div className="flex flex-col gap-4">
        <h1 className="sr-only">Projects</h1>
        <ProjectsToolbar view={view} counts={counts} onChange={update} />
        {data.list.isPending ? (
          <TableSkeleton label="Loading projects" rows={3} columns={SKELETON} />
        ) : data.list.isError ? (
          <EmptyState
            icon={<Icon name="alert" />}
            title="Projects could not be loaded"
            description={`${data.list.error.message} Check your connection, then try again.`}
            action={<Button onClick={() => void data.list.refetch()}>Retry</Button>}
          />
        ) : view.layout === 'grid' ? (
          <ProjectsGrid rows={rows} actions={actions} empty={empty} />
        ) : (
          <ProjectsTable
            rows={rows}
            sort={view.sort}
            onSort={(sort) => update({ sort })}
            actions={actions}
            empty={empty}
          />
        )}
      </div>
    </>
  );
}
