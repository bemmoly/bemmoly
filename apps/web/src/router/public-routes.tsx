import { createRoute, lazyRouteComponent } from '@tanstack/react-router';
import { requireSetupOpen, requireSignedOut } from './guards.ts';
import { rootRoute } from './root.tsx';

const text = (value: unknown) => (typeof value === 'string' && value ? value : undefined);

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'login',
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: text(search['redirect']),
  }),
  beforeLoad: ({ context, search }) =>
    requireSignedOut(context.queryClient, search.redirect ?? '/'),
  component: lazyRouteComponent(() => import('../pages/auth/login-page.tsx'), 'LoginPage'),
});

export const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'forgot-password',
  component: lazyRouteComponent(
    () => import('../pages/auth/forgot-password-page.tsx'),
    'ForgotPasswordPage',
  ),
});

/** Email links carry the token in the fragment (#token=…), so it never reaches a server log. */
export const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'reset-password',
  component: lazyRouteComponent(
    () => import('../pages/auth/reset-password-page.tsx'),
    'ResetPasswordPage',
  ),
});

export const invitationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'accept-invitation',
  component: lazyRouteComponent(
    () => import('../pages/auth/accept-invitation-page.tsx'),
    'AcceptInvitationPage',
  ),
});

/** The per-kind unsubscribe link in every notification email; works without signing in. */
export const unsubscribeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'unsubscribe',
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: text(search['token']),
  }),
  component: lazyRouteComponent(
    () => import('../pages/auth/unsubscribe-page.tsx'),
    'UnsubscribePage',
  ),
});

const STEPS = [1, 2, 3, 4, 5, 6] as const;

export const setupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'setup',
  validateSearch: (search: Record<string, unknown>): { step?: number } => {
    const step = Number(search['step']);
    return { step: STEPS.includes(step as (typeof STEPS)[number]) ? step : undefined };
  },
  beforeLoad: ({ context }) => requireSetupOpen(context.queryClient),
  component: lazyRouteComponent(() => import('../pages/setup/setup-page.tsx'), 'SetupPage'),
});

export const publicRoutes = [
  loginRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  unsubscribeRoute,
  invitationRoute,
  setupRoute,
];
