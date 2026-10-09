import type { MouseEvent } from 'react';

/*
 * Leaving the Backlog for another Work screen without a reload. The issue
 * screens (the Issue page and the slide-over) have not joined this branch
 * yet; until they do, opening an issue goes to the Issue page's path the way
 * their navigation does, and this file is where the slide-over is swapped in.
 */

interface RouterState {
  __TSR_index?: number;
  [key: string]: unknown;
}

export const issuePath = (key: string) => `/work/issue/${encodeURIComponent(key)}`;

/** The shell's router follows history.pushState; the entry carries the index it expects. */
export function navigateTo(path: string): void {
  const state = (window.history.state ?? {}) as RouterState;
  const entry = Math.random().toString(36).slice(2, 10);
  window.history.pushState(
    { ...state, key: entry, __TSR_key: entry, __TSR_index: (state.__TSR_index ?? 0) + 1 },
    '',
    path,
  );
}

export function openIssue(key: string): void {
  navigateTo(issuePath(key));
}

/** Plain clicks on same-origin links inside the screen stay in the page. */
export function keepLinksInApp(event: MouseEvent<HTMLElement>): void {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const anchor = (event.target as Element).closest?.('a[href]');
  const href = anchor?.getAttribute('href') ?? '';
  if (!href.startsWith('/') || href.startsWith('//') || anchor?.getAttribute('target')) return;
  event.preventDefault();
  navigateTo(href);
}
