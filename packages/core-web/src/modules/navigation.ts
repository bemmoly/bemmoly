/*
 * In-app navigation for module chunks, which do not import the shell's
 * router. The shell registers its router here at startup, so a chunk's move
 * goes through the router like a top bar link does: leave guards see it and
 * the history entry is the router's own.
 */

/** replace: swap the current history entry instead of adding one (a redirect, closing a dialog). */
export type ShellNavigator = (path: string, options?: { replace?: boolean }) => void;

let shellNavigator: ShellNavigator | null = null;

/** The shell's router; null clears it (tests). */
export function setShellNavigator(next: ShellNavigator | null): void {
  shellNavigator = next;
}

/**
 * Moves to `path` without a reload. With no shell router (unit tests,
 * Storybook) it pushes a history entry and the popstate a router listens for.
 */
export function navigateInApp(path: string, options: { replace?: boolean } = {}): void {
  if (shellNavigator) {
    shellNavigator(path, options);
    return;
  }
  if (options.replace) window.history.replaceState(window.history.state, '', path);
  else window.history.pushState(window.history.state, '', path);
  window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
}
