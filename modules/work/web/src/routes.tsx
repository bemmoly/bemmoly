import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export interface WorkScreenProps {
  /** The project key named in the path, e.g. "PLT" in /work/board/PLT. */
  projectKey: string | undefined;
  /** Anything after the project key, for screens that nest deeper. */
  rest: string[];
}

type Screen = LazyExoticComponent<ComponentType<WorkScreenProps>>;

/**
 * Subpath → screen, one line each. The first segment picks the screen, the
 * second is the project key, the rest is the screen's own. Each screen is its
 * own lazy file, so opening the Board does not load the Backlog.
 */
export const WORK_SCREENS: Readonly<Record<string, Screen>> = {
  board: lazy(() => import('./board/board-screen.tsx')),
  issue: lazy(() => import('./issue/issue-screen.tsx')),
  create: lazy(() => import('./create/create-screen.tsx')),
  projects: lazy(() => import('./projects/projects-screen.tsx')),
  workflows: lazy(() => import('./workflow/workflows-screen.tsx')),
};

/** "/board/PLT/x" → the Board screen with projectKey "PLT" and rest ["x"]. */
export function resolveWorkRoute(subpath: string) {
  const [screen = 'board', projectKey, ...rest] = subpath.split('/').filter(Boolean);
  const Screen = WORK_SCREENS[screen];
  return Screen ? { Screen, props: { projectKey, rest } satisfies WorkScreenProps } : null;
}
