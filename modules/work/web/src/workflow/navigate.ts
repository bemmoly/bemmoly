import { navigateInApp } from '@bemmoly/core-web';
import type { MouseEvent } from 'react';

/** Where the workflow screens live under the Work chunk. */
export const workflowPaths = {
  list: (projectKey: string) => `/work/workflows/${projectKey}`,
  editor: (projectKey: string, workflowId: string) => `/work/workflows/${projectKey}/${workflowId}`,
};

/**
 * Moves within the app without a reload, through the shell's router, so a
 * page holding unsaved work is asked first as it is for a top bar link.
 */
export function navigate(path: string): void {
  navigateInApp(path);
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
