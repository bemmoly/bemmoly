import type { MouseEvent } from 'react';

/** Where the Work screens live in the shell's address space. */
export const workPaths = {
  issue: (key: string) => `/work/issue/${key}`,
  board: (projectKey: string) => `/work/board/${projectKey}`,
  projects: () => '/work/projects',
  newProject: () => '/work/projects/new',
  createIssue: (projectKey?: string) => `/work/create${projectKey ? `/${projectKey}` : ''}`,
};

interface RouterState {
  __TSR_index?: number;
  [key: string]: unknown;
}

/**
 * Moves the shell to `path` without a reload. The chunk has no router of its own; the shell's
 * router follows history.pushState, so the entry carries the index and key it expects.
 */
export function navigateTo(path: string): void {
  const state = (window.history.state ?? {}) as RouterState;
  const key = Math.random().toString(36).slice(2, 10);
  window.history.pushState(
    { ...state, key, __TSR_key: key, __TSR_index: (state.__TSR_index ?? 0) + 1 },
    '',
    path,
  );
}

/** Steps back when the person came from somewhere in the app, otherwise opens `fallback`. */
export function navigateBack(fallback: string): void {
  const state = (window.history.state ?? {}) as RouterState;
  if ((state.__TSR_index ?? 0) > 0) window.history.back();
  else navigateTo(fallback);
}

/**
 * Props for an in-app link: a real href, so it opens in a new tab with a modifier, and a
 * plain click that stays in the page.
 */
export function linkTo(path: string) {
  return {
    href: path,
    onClick: (event: MouseEvent<HTMLElement>) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      navigateTo(path);
    },
  };
}
