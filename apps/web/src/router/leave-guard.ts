import type { LeaveGuardHook } from '@bemmoly/core-web';
import { useBlocker } from '@tanstack/react-router';

/**
 * The shell's leave guard on the router's blocker: while `when` holds, a move
 * to another path (a link, Back, a module's in-app navigation) waits for stay
 * or leave, and closing or reloading the tab asks the browser's question.
 * Kernel settings pages and module chunks share it through LeaveGuardProvider.
 */
export const useRouterLeaveGuard: LeaveGuardHook = ({ when, shouldBlock }) => {
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) =>
      when &&
      (shouldBlock
        ? shouldBlock({ from: current.pathname, to: next.pathname })
        : current.pathname !== next.pathname),
    enableBeforeUnload: () => when,
    withResolver: true,
  });
  const blocked = blocker.status === 'blocked';
  return {
    blocked,
    to: blocked ? blocker.next.pathname : null,
    stay: () => blocker.reset?.(),
    leave: () => blocker.proceed?.(),
  };
};
