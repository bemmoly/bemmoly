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
    context: { queryClient },
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
  });
  /** Module chunks navigate through the router, so leave guards see their moves too. */
  setShellNavigator((path) => router.history.push(path));
  /** A session that expires mid-use sends the person to sign in, then back here. */
  setUnauthenticatedHandler(() => {
    const here = router.state.location;
    if (here.pathname === '/login' || here.pathname.startsWith('/setup')) return;
    queryClient.removeQueries({ queryKey: ['session'] });
    void router.navigate({ to: '/login', search: { redirect: here.href } });
  });
  return router;
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
