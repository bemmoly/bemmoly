import { LeaveGuardProvider } from '@bemmoly/core-web';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { render, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { meQuery } from '../hooks/use-session.ts';
import { api } from '../lib/api.ts';
import { useRouterLeaveGuard } from '../router/leave-guard.ts';

export function testQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

/** A QueryClient with the signed-in person already loaded, as the authenticated layout leaves it. */
export async function signedInClient(): Promise<QueryClient> {
  const client = testQueryClient();
  await client.fetchQuery({ ...meQuery, queryFn: () => api.auth.me() });
  return client;
}

/** Renders a hook with TanStack Query (and the session, unless `client` says otherwise). */
export async function renderQueryHook<T>(hook: () => T, client?: QueryClient) {
  const queryClient = client ?? (await signedInClient());
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { ...renderHook(hook, { wrapper }), queryClient };
}

/** Renders a page inside a one-route router, so Link, useNavigate and the leave guard work. */
export async function renderPage(ui: () => ReactNode, path = '/', client?: QueryClient) {
  const queryClient = client ?? (await signedInClient());
  const root = createRootRoute({
    component: () => (
      <LeaveGuardProvider hook={useRouterLeaveGuard}>
        <Outlet />
      </LeaveGuardProvider>
    ),
  });
  const page = createRoute({ getParentRoute: () => root, path: '$', component: ui });
  const index = createRoute({ getParentRoute: () => root, path: '/', component: ui });
  const router = createRouter({
    routeTree: root.addChildren([index, page]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, queryClient, router };
}
