import { setShellNavigator } from '@bemmoly/core-web';
import type { QueryClient } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';
import { setUnauthenticatedHandler } from './lib/api.ts';
import {
  appRoute,
  devMailboxRoute,
  homeRoute,
  inboxRoute,
  moduleDeepRoute,
  moduleRoute,
} from './router/app-routes.tsx';
import { publicRoutes } from './router/public-routes.tsx';
import { rootRoute } from './router/root.tsx';
import { settingsTree } from './router/settings-routes.tsx';

const routeTree = rootRoute.addChildren([
  ...publicRoutes,
  appRoute.addChildren([
    homeRoute,
    inboxRoute,
    settingsTree,
    devMailboxRoute,
    moduleRoute,
    moduleDeepRoute,
  ]),
]);

export function createAppRouter(queryClient: QueryClient) {
  const router = createRouter({
    routeTree,
    // '/' for an install; the demo build is served under bemmoly.com/demo.
    basepath: import.meta.env.BASE_URL,
    context: { queryClient },
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    // Every navigation is a transition that waits on the next page's chunk; without a pending
    // state the old page stays up meanwhile. Pages in the frame name theirs (app-routes.tsx).
    // A fast load never flashes the skeleton, and a slow one never flickers it.
    defaultPendingMs: 150,
    defaultPendingMinMs: 200,
  });
  /** Module chunks navigate through the router, so leave guards see their moves too. */
  setShellNavigator((path, options) =>
    options?.replace ? router.history.replace(path) : router.history.push(path),
  );
  /** A session that expires mid-use sends the person to sign in, then back here. */
  setUnauthenticatedHandler(() => {
    const here = router.state.location;
    if (here.pathname === '/login' || here.pathname.startsWith('/setup')) return;
    queryClient.removeQueries({ queryKey: ['session'] });
    void router.navigate({ to: '/login', search: { redirect: here.href, reason: 'expired' } });
  });
  return router;
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
