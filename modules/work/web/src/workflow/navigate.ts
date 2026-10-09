import type { MouseEvent } from 'react';

/** Where the workflow screens live under the Work chunk. */
export const workflowPaths = {
  list: (projectKey: string) => `/work/workflows/${projectKey}`,
  editor: (projectKey: string, workflowId: string) => `/work/workflows/${projectKey}/${workflowId}`,
};

/**
 * Moves within the app without a reload. A chunk does not import the
 * shell's router; the router follows the browser history, so a pushed entry
 * plus the popstate it listens for is the whole contract.
 */
export function navigate(path: string): void {
  window.history.pushState(window.history.state, '', path);
  window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
}

/** For an <a href>: a plain click navigates in place; modified clicks keep the browser's meaning. */
export function onLinkClick(path: string) {
  return (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    navigate(path);
  };
}
