import type { Project } from '@bemmoly/module-work/shared';
import { formatRelative } from '@bemmoly/core-web';
import { Button, EmptyState, PageHeader, Skeleton, Table, Tag, useToast } from '@bemmoly/ui';
import { useQuery } from '@tanstack/react-query';
import { navigateBack, navigateTo, workPaths } from '../hooks/issue-navigation.ts';
import { useTeams } from '../hooks/projects-list.ts';
import type { WorkScreenProps } from '../routes.tsx';
import { projectsQuery } from '../shared/use-project.ts';
import { CreateProjectDialog } from './create-project-dialog.tsx';

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
              : []
          }
          actions={
            <Button variant="primary" onClick={() => navigateTo(workPaths.newProject())}>
              Create project
            </Button>
          }
        />
        {projects.isPending ? (
          <Skeleton shape="block" height={160} />
        ) : projects.isError ? (
          <EmptyState title="Projects could not be loaded" description={projects.error.message} />
        ) : (
          <Table<Project>
            label="Projects"
            rows={rows}
            rowKey={(project) => project.id}
            onRowClick={(project) => navigateTo(workPaths.board(project.key))}
            empty={
              <EmptyState
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
                    <span className="truncate font-medium text-tx">{project.name}</span>
                    {project.description && (
                      <span className="truncate text-12 text-tx5">{project.description}</span>
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
