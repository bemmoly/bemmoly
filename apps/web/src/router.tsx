import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from '@tanstack/react-router';
import { HomePage } from './pages/home-page.tsx';
import { RootLayout } from './pages/root-layout.tsx';
import { modulesQuery } from './hooks/use-modules.ts';

interface RouterContext {
  queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  loader: ({ context }) => context.queryClient.ensureQueryData(modulesQuery),
});

const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomePage });

const moduleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '$moduleId',
  component: lazyRouteComponent(() => import('./pages/module-page.tsx'), 'ModulePage'),
});

const routeTree = rootRoute.addChildren([homeRoute, moduleRoute]);

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({ routeTree, context: { queryClient }, defaultPreload: 'intent' });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
