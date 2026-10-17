import { useRouterState } from '@tanstack/react-router';

/**
 * The address bar's path, /pipelines included, re-read whenever the router moves. Links built
 * from it go through history directly, so they never depend on how the router trims its base.
 */
export function useBrowserPath(): string {
  useRouterState({ select: (state) => state.location.href });
  return window.location.pathname;
}
