import type { Project } from '@bemmoly/module-work/shared';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from './api.ts';
import { workKeys } from './keys.ts';
import { rememberProject, useProjectStore } from './project-store.ts';

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
 * The current project of the Work screens. A key in the path is taken over the person's
 * last project, and when neither names one they can see the first listed is chosen, so
 * Board and Backlog open on something. Whichever is shown becomes the last project.
 */
export function useProject(pathKey?: string): ProjectContext {
  const query = useQuery(projectsQuery);
  const { projectKey: stored, setProjectKey } = useProjectStore();
  const projects = query.data?.items ?? [];
  const fromPath = pathKey?.toUpperCase();
  // A remembered project that is gone (deleted, or access lost) falls back to the first one.
  const project = fromPath
    ? projects.find((item) => item.key === fromPath)
    : (projects.find((item) => item.key === stored) ?? projects[0]);
  const wanted = fromPath ?? stored;

  const key = project?.key;
  useEffect(() => {
    if (key) rememberProject(key);
  }, [key]);

  return {
    projects,
    project,
    projectKey: project?.key ?? wanted,
    isPending: query.isPending,
    setProjectKey,
  };
}
