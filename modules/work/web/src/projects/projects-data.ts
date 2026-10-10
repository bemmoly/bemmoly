import type { Project, ProjectsPage } from '@bemmoly/module-work/shared';
import type { Team } from '@bemmoly/shared';
import { useToast } from '@bemmoly/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useTeams } from '../hooks/projects-list.ts';
import { api } from '../shared/api.ts';
import { workKeys } from '../shared/keys.ts';

/** Every project, archived ones included; the page splits them into its segments. */
export const allProjectsKey = () => [...workKeys.projects(), 'with-archived'] as const;

/**
 * The Projects page's data: the projects (archived too), the teams that own them, and an
 * archive that happens at once with Undo. The row flips before the server answers; a refusal
 * puts it back and says why.
 */
export function useProjectsData() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const list = useQuery({
    queryKey: allProjectsKey(),
    queryFn: () => api.work.projectCatalog.list({ archived: true, limit: 100 }),
  });
  const teams = useTeams();
  const teamOf = useCallback(
    (project: Project): Team | undefined =>
      teams.data?.items.find((team) => team.id === project.teamId),
    [teams.data],
  );

  const setArchivedAt = (key: string, archivedAt: string | null) =>
    queryClient.setQueryData<ProjectsPage>(
      allProjectsKey(),
      (page) =>
        page && {
          ...page,
          items: page.items.map((row) => (row.key === key ? { ...row, archivedAt } : row)),
        },
    );

  const archive = useMutation({
    mutationFn: ({ project, archived }: { project: Project; archived: boolean }) =>
      archived
        ? api.work.projectCatalog.archive(project.key)
        : api.work.projectCatalog.unarchive(project.key),
    onMutate: async ({ project, archived }) => {
      await queryClient.cancelQueries({ queryKey: allProjectsKey() });
      setArchivedAt(project.key, archived ? new Date().toISOString() : null);
    },
    onError: (error, { project, archived }) => {
      setArchivedAt(project.key, archived ? null : project.archivedAt);
      toast.show({
        tone: 'danger',
        title: archived ? `${project.name} was not archived` : `${project.name} is still archived`,
        body: error.message,
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: workKeys.projects() }),
  });

  /** Archive now, offer Undo; Undo restores it the same way. */
  const toggleArchive = (project: Project) => {
    const archived = project.archivedAt === null;
    archive.mutate({ project, archived });
    if (archived)
      toast.undo({
        title: `Archived ${project.name}`,
        body: 'It leaves the sidebar and pickers; its issues stay.',
        onUndo: () =>
          archive.mutate({ project: { ...project, archivedAt: 'now' }, archived: false }),
      });
    else toast.show({ tone: 'ok', title: `Restored ${project.name}` });
  };

  return { list, projects: list.data?.items ?? [], teamOf, toggleArchive };
}
