import { ToastProvider } from '@bemmoly/ui';
import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { ToastBridge } from '../components/toast-bridge.tsx';
import { ErrorPage } from '../pages/error-page.tsx';
import { NotFoundPage } from '../pages/not-found-page.tsx';

export interface RouterContext {
  queryClient: QueryClient;
}

export const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <ToastProvider>
      <Outlet />
      <ToastBridge />
    </ToastProvider>
  ),
  notFoundComponent: NotFoundPage,
  errorComponent: ErrorPage,
});
