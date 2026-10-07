import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { ErrorPage } from '../pages/error-page.tsx';
import { NotFoundPage } from '../pages/not-found-page.tsx';
import { Toaster } from '../ui.ts';

export interface RouterContext {
  queryClient: QueryClient;
}

export const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <>
      <Outlet />
      <Toaster />
    </>
  ),
  notFoundComponent: NotFoundPage,
  errorComponent: ErrorPage,
});
