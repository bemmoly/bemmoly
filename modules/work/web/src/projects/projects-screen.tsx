import type { Project } from '@bemmoly/module-work/shared';
import { formatRelative } from '@bemmoly/core-web';
import { Button, EmptyState, PageHeader, Table, TableSkeleton, Tag, useToast } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useQuery } from '@tanstack/react-query';
import { navigateBack, navigateTo, workPaths } from '../hooks/issue-navigation.ts';
import { useTeams } from '../hooks/projects-list.ts';
import type { WorkScreenProps } from '../routes.tsx';
import { LineSkeleton } from '../skeletons/parts.tsx';
import { BoxCell, MenuCell, TwoLineCell } from '../skeletons/table-cells.tsx';
import { projectsQuery } from '../shared/use-project.ts';
import { CreateProjectDialog } from './create-project-dialog.tsx';
import { ProjectRowMenu } from './project-row-menu.tsx';

/**
 * The project list at /work/projects, with the create dialog open at /work/projects/new so
 * the top bar's Create menu can link to it. A row opens the project's board.
 */
export default function ProjectsScreen({ projectKey: segment }: WorkScreenProps) {
  const creating = segment === 'new';
  const projects = useQuery(projectsQuery);
  const teams = useTeams();
  const toast = useToast();
  const teamName = (id: string | null) => teams.data?.items.find((team) => team.id === id)?.name;
  const rows = projects.data?.items ?? [];

  const created = (project: Project) => {
    toast.show({
      tone: 'ok',
      title: `Created ${project.name}`,
      body: `Issues in it are numbered ${project.key}-1, ${project.key}-2 and on.`,
    });
    navigateTo(workPaths.board(project.key));
  };

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="mx-auto flex max-w-310 flex-col gap-4 px-10 pt-5 pb-15">
        <PageHeader
          title="Projects"
          meta={
            projects.isSuccess
              ? [`${rows.length} ${rows.length === 1 ? 'project' : 'projects'}`]
              : [<LineSkeleton key="count" width={60} size="text-12h" bar={8} />]
          }
          actions={
            <Button variant="primary" onClick={() => navigateTo(workPaths.newProject())}>
              Create project
            </Button>
          }
        />
        {projects.isPending ? (
          <TableSkeleton
            label="Loading projects"
            rows={3}
            columns={[
              { width: '90px', cell: <LineSkeleton width={32} bar={9} /> },
              { width: 'minmax(0,1.6fr)', cell: <TwoLineCell width="32%" second="48%" /> },
              { width: '110px', cell: <BoxCell width={48} /> },
              { width: 'minmax(0,1fr)' },
              { width: '120px' },
              { width: '28px', align: 'center', cell: <MenuCell /> },
            ]}
          />
        ) : projects.isError ? (
          <EmptyState
            icon={<Icon name="alert" />}
            title="Projects could not be loaded"
            description={projects.error.message}
            action={<Button onClick={() => void projects.refetch()}>Try again</Button>}
          />
        ) : (
          <Table<Project>
            label="Projects"
            rows={rows}
            rowKey={(project) => project.id}
            onRowClick={(project) => navigateTo(workPaths.board(project.key))}
            empty={
              <EmptyState
                icon={<Icon name="project" />}
                title="No projects yet"
                description="A project holds issues under one key, with its own board and backlog."
                action={
                  <Button variant="primary" onClick={() => navigateTo(workPaths.newProject())}>
                    Create project
                  </Button>
                }
              />
            }
            columns={[
              {
                key: 'key',
                header: 'Key',
                width: '90px',
                render: (project) => (
                  <span className="font-mono text-12 font-medium text-tx3">{project.key}</span>
                ),
              },
              {
                key: 'name',
                header: 'Name',
                width: 'minmax(0,1.6fr)',
                render: (project) => (
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-tx" title={project.name}>
                      {project.name}
                    </span>
                    {project.description && (
                      <span className="truncate text-12 text-tx5" title={project.description}>
                        {project.description}
                      </span>
                    )}
                  </span>
                ),
              },
              {
                key: 'method',
                header: 'Method',
                width: '110px',
                render: (project) => <Tag>{project.method === 'scrum' ? 'Scrum' : 'Kanban'}</Tag>,
              },
              {
                key: 'team',
                header: 'Team',
                width: 'minmax(0,1fr)',
                render: (project) => (
                  <span className="truncate text-tx2">{teamName(project.teamId) ?? '—'}</span>
                ),
              },
              {
                key: 'updated',
                header: 'Updated',
                width: '120px',
                render: (project) => (
                  <span className="text-12h text-tx4">{formatRelative(project.updatedAt)}</span>
                ),
              },
              {
                key: 'menu',
                header: <span className="sr-only">Actions</span>,
                width: '28px',
                align: 'center',
                render: (project) => <ProjectRowMenu project={project} />,
              },
            ]}
          />
        )}
      </div>
      <CreateProjectDialog
        open={creating}
        onClose={() => navigateBack(workPaths.projects())}
        onCreated={created}
      />
    </div>
  );
}
