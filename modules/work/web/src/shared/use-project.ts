import type { Project } from '@bemmoly/module-work/shared';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from './api.ts';
import { workKeys } from './keys.ts';
import { useProjectStore } from './project-store.ts';

/** The projects this person can see; small enough to hold whole for the picker. */
export const projectsQuery = queryOptions({
  queryKey: workKeys.projects(),
  queryFn: () => api.work.projects.list({ limit: 100 }),
});

export interface ProjectContext {
  projects: Project[];
  project: Project | undefined;
  projectKey: string | null;
  isPending: boolean;
  setProjectKey(key: string): void;
}

/**
 * The current project of the Work screens. A key in the path is taken over
 * the store, and when neither names a project the first listed one is chosen
 * so Board and Backlog open on something.
 */
export function useProject(pathKey?: string): ProjectContext {
  const query = useQuery(projectsQuery);
  const stored = useProjectStore((state) => state.projectKey);
  const setProjectKey = useProjectStore((state) => state.setProjectKey);
  const projects = query.data?.items ?? [];
  const wanted = pathKey?.toUpperCase() ?? stored;
  const project =
    projects.find((item) => item.key === wanted) ?? (wanted === null ? projects[0] : undefined);

  useEffect(() => {
    if (project && project.key !== stored) setProjectKey(project.key);
  }, [project, stored, setProjectKey]);

  return {
    projects,
    project,
    projectKey: project?.key ?? wanted,
    isPending: query.isPending,
    setProjectKey,
  };
}
