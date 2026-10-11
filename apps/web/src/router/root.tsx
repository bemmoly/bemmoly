import { LeaveGuardProvider } from '@bemmoly/core-web';
import { ToastProvider } from '@bemmoly/ui';
import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { ToastBridge } from '../components/toast-bridge.tsx';
import { ErrorPage } from '../pages/error-page.tsx';
import { NotFoundPage } from '../pages/not-found-page.tsx';
import { useRouterLeaveGuard } from './leave-guard.ts';

export interface RouterContext {
  queryClient: QueryClient;
}

export const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <LeaveGuardProvider hook={useRouterLeaveGuard}>
      <ToastProvider>
        <Outlet />
        <ToastBridge />
      </ToastProvider>
    </LeaveGuardProvider>
  ),
  notFoundComponent: NotFoundPage,
  errorComponent: ErrorPage,
});
