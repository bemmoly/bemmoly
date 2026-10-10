import type { MouseEvent } from 'react';

/** Where the Docs screens live in the shell's address space. */
export const docsPaths = {
  home: () => '/docs',
  space: (spaceKey: string) => `/docs/s/${spaceKey}`,
  trash: (spaceKey: string) => `/docs/s/${spaceKey}/trash`,
  page: (pageId: string) => `/docs/p/${pageId}`,
  /** The global Create menu's entries, as module.ts registers them. */
  createPage: () => '/docs/create',
  createSpace: () => '/docs/spaces/new',
};

interface RouterState {
  __TSR_index?: number;
  [key: string]: unknown;
}

/**
 * Moves the shell to `path` without a reload. The chunk has no router of its
 * own; the shell's router follows history.pushState, so the entry carries the
 * index and key it expects (as Work's navigation does).
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

/** As navigateTo, in place of the current entry: Back skips a page that no longer exists. */
export function replaceWith(path: string): void {
  const state = (window.history.state ?? {}) as RouterState;
  const key = Math.random().toString(36).slice(2, 10);
  window.history.replaceState({ ...state, key, __TSR_key: key }, '', path);
}

const plainClick = (event: MouseEvent<HTMLElement>) =>
  !event.defaultPrevented &&
  event.button === 0 &&
  !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);

/**
 * A click handler for a whole screen: plain clicks on same-origin links inside
 * it stay in the page; a modifier click still opens a new tab.
 */
export function keepLinksInApp(event: MouseEvent<HTMLElement>): void {
  if (!plainClick(event)) return;
  const anchor = (event.target as Element).closest?.('a[href]');
  if (anchor?.closest('[contenteditable="true"]')) return;
  const href = anchor?.getAttribute('href') ?? '';
  if (!href.startsWith('/') || href.startsWith('//') || anchor?.getAttribute('target')) return;
  event.preventDefault();
  navigateTo(href);
}
