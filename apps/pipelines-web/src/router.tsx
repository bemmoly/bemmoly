import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from '@tanstack/react-router';
import { meQuery } from './hooks/use-me.ts';
import { BASE_PATH } from './lib/sign-in.ts';
import { NotFoundScreen } from './screens/not-found.tsx';
import { PipelinesShell } from './shell/pipelines-shell.tsx';

interface RouterContext {
  queryClient: QueryClient;
}

/** ?scope= on every screen; anything else a screen reads it validates itself. */
const validateScope = (search: Record<string, unknown>): { scope?: string } =>
  typeof search['scope'] === 'string' && search['scope'] ? { scope: search['scope'] } : {};

const root = createRootRouteWithContext<RouterContext>()({
  // The session is the kernel's: no person, and the API client sends them to sign-in.
  beforeLoad: ({ context }) => context.queryClient.ensureQueryData(meQuery),
  component: PipelinesShell,
  notFoundComponent: NotFoundScreen,
  validateSearch: validateScope,
});

/** One lazy chunk per screen, so the shell paints before any screen's code arrives. */
const screen = (path: string, load: Parameters<typeof lazyRouteComponent>[0]) =>
  createRoute({ getParentRoute: () => root, path, component: lazyRouteComponent(load) });

const routeTree = root.addChildren([
  screen('/', () => import('./screens/for-you.tsx')),
  screen('/map', () => import('./screens/map.tsx')),
  screen('/catalog', () => import('./screens/catalog.tsx')),
  screen('/runs', () => import('./screens/runs.tsx')),
  screen('/releases', () => import('./screens/releases.tsx')),
  screen('/insights', () => import('./screens/insights.tsx')),
  screen('/platform', () => import('./screens/platform.tsx')),
  screen('/settings', () => import('./screens/settings.tsx')),
]);

export function createPipelinesRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    basepath: BASE_PATH,
    context: { queryClient },
    defaultPreload: 'intent',
    scrollRestoration: true,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createPipelinesRouter>;
  }
}
