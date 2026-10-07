import { createRoute, lazyRouteComponent } from '@tanstack/react-router';
import { AppShell } from '../components/shell/app-shell.tsx';
import { HomePage } from '../pages/home-page.tsx';
import { requireSession } from './guards.ts';
import { rootRoute } from './root.tsx';

/** Everything behind sign-in shares the top bar, the palette and the inbox. */
export const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  beforeLoad: async ({ context, location }) => ({
    me: await requireSession(context.queryClient, location.href),
  }),
  component: AppShell,
});

export const homeRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  component: HomePage,
});

/** The full-page inbox; email links and the drawer's "See all" land here. */
export const inboxRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'inbox',
  component: lazyRouteComponent(() => import('../pages/inbox-page.tsx'), 'InboxPage'),
});

export const devMailboxRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'dev/mailbox',
  component: lazyRouteComponent(() => import('../pages/dev-mailbox-page.tsx'), 'DevMailboxPage'),
});

const modulePage = lazyRouteComponent(() => import('../pages/module-page.tsx'), 'ModulePage');

/** Module areas are path-routed: /sample, /work/boards/12, … */
export const moduleRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '$moduleId',
  component: modulePage,
});

export const moduleDeepRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '$moduleId/$',
  component: modulePage,
});
