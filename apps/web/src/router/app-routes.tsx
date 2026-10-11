import { setPreferenceOwner } from '@bemmoly/core-web';
import { createRoute, lazyRouteComponent } from '@tanstack/react-router';
import { AppShell } from '../components/shell/app-shell.tsx';
import { HomePage } from '../pages/home-page.tsx';
import { requireSession } from './guards.ts';
import { rootRoute } from './root.tsx';

/** Everything behind sign-in shares the frame: the sidebar, the palette and create dialogs. */
export const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  beforeLoad: async ({ context, location }) => {
    const me = await requireSession(context.queryClient, location.href);
    // The sidebar's fold, recents and the last project are this person's, read from the start.
    setPreferenceOwner(me.user.id);
    return { me };
  },
  component: AppShell,
});

export const homeRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  component: HomePage,
});

export interface InboxSearch {
  /** The selected notification, so a reload or a shared link keeps it open. */
  item?: string;
  filter?: 'mentions' | 'reviews' | 'assigned';
  view?: 'snoozed' | 'done';
}

const pick = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined =>
  allowed.includes(value as T) ? (value as T) : undefined;

/** The inbox's triage view; email links, the sidebar and Home's preview land here. */
export const inboxRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'inbox',
  validateSearch: (search: Record<string, unknown>): InboxSearch => {
    const item = typeof search['item'] === 'string' ? search['item'] : undefined;
    const filter = pick(search['filter'], ['mentions', 'reviews', 'assigned'] as const);
    const view = pick(search['view'], ['snoozed', 'done'] as const);
    return { ...(item ? { item } : {}), ...(filter ? { filter } : {}), ...(view ? { view } : {}) };
  },
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
