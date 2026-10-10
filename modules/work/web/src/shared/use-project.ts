import type { Project, ProjectsPage } from '@bemmoly/module-work/shared';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from './api.ts';
import { workKeys } from './keys.ts';
import { rememberProject, useProjectStore } from './project-store.ts';

/** The server's largest page, and a ceiling of pages no real workspace reaches. */
const PAGE = 200;
const MOST_PAGES = 25;

/**
 * Every project this person can see, page after page: the switcher, the pickers and each
 * project's screens find their project in it, so one cut off after the first page would
 * leave a busy workspace's newest projects without a board.
 */
export async function listEveryProject(archived = false): Promise<ProjectsPage> {
  const items: Project[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MOST_PAGES; page += 1) {
    const next: ProjectsPage = await api.work.projects.list({
      limit: PAGE,
      archived,
      ...(cursor ? { cursor } : {}),
    });
    items.push(...next.items);
    cursor = next.nextCursor;
    if (!cursor) break;
  }
  return { items, nextCursor: cursor };
}

/** The projects this person can see; small enough to hold whole for the picker. */
export const projectsQuery = queryOptions({
  queryKey: workKeys.projects(),
  queryFn: () => listEveryProject(),
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
