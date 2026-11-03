import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
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
const screen = <Path extends string>(path: Path, load: Parameters<typeof lazyRouteComponent>[0]) =>
  createRoute({ getParentRoute: () => root, path, component: lazyRouteComponent(load) });

/** Platform's areas share one frame with their tabs; /platform opens the first. */
const platform = createRoute({
  getParentRoute: () => root,
  path: '/platform',
  beforeLoad: ({ location }) => {
    if (/\/platform\/?$/.test(location.pathname))
      throw redirect({ href: `${BASE_PATH}/platform/clouds`, replace: true });
  },
  component: lazyRouteComponent(() => import('./screens/platform/layout.tsx')),
});
const platformArea = (path: string, load: Parameters<typeof lazyRouteComponent>[0]) =>
  createRoute({ getParentRoute: () => platform, path, component: lazyRouteComponent(load) });

/** A service's page: its tabs share one frame, each with its own address. */
const service = createRoute({
  getParentRoute: () => root,
  path: '/services/$key',
  component: lazyRouteComponent(() => import('./screens/service/layout.tsx')),
});
const serviceTab = <Path extends string>(
  path: Path,
  load: Parameters<typeof lazyRouteComponent>[0],
) => createRoute({ getParentRoute: () => service, path, component: lazyRouteComponent(load) });

const routeTree = root.addChildren([
  screen('/', () => import('./screens/for-you/for-you-screen.tsx')),
  screen('/applications/$key', () => import('./screens/application/application-screen.tsx')),
  screen('/services', () => import('./screens/services/index.tsx')),
  service.addChildren([
    serviceTab('/', () => import('./screens/service/overview.tsx')),
    serviceTab('/versions', () => import('./screens/service/versions.tsx')),
    serviceTab('/runs', () => import('./screens/service/runs.tsx')),
    serviceTab('/pipelines', () => import('./screens/service/pipelines.tsx')),
    serviceTab('/settings', () => import('./screens/service/settings.tsx')),
    serviceTab('/logs', () => import('./screens/service/logs.tsx')),
  ]),
  screen('/runs', () => import('./screens/runs/runs-screen.tsx')),
  screen('/runs/$id', () => import('./screens/run/run-screen.tsx')),
  screen('/releases/$releaseId/promote', () => import('./screens/promote/index.tsx')),
  screen('/changes', () => import('./screens/change-requests/index.tsx')),
  screen('/changes/new', () => import('./screens/change-requests/new.tsx')),
  screen('/changes/$number', () => import('./screens/change-requests/detail.tsx')),
  screen('/environments', () => import('./screens/environments/index.tsx')),
  screen('/setup/cloud', () => import('./screens/setup/cloud.tsx')),
  platform.addChildren([
    platformArea('/people', () => import('./screens/platform/people/index.tsx')),
    platformArea('/approvals', () => import('./screens/platform/approvals/index.tsx')),
    platformArea('/templates', () => import('./screens/platform/templates/index.tsx')),
    platformArea('/runners', () => import('./screens/platform/runners/index.tsx')),
    platformArea('/access', () => import('./screens/platform/access/index.tsx')),
    platformArea('/capacity', () => import('./screens/platform/capacity/index.tsx')),
    platformArea('/clouds', () => import('./screens/platform/clouds/index.tsx')),
    platformArea('/clouds/connect', () => import('./screens/platform/clouds/connect.tsx')),
    platformArea('/environments', () => import('./screens/platform/environments/index.tsx')),
    platformArea('/clusters', () => import('./screens/platform/clusters/index.tsx')),
    platformArea('/export', () => import('./screens/platform/export/index.tsx')),
  ]),
  screen('/start', () => import('./screens/start/index.tsx')),
  screen('/settings', () => import('./screens/settings/index.tsx')),
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
