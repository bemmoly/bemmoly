import { buildSettingsNav, canOpen, flattenSettings, KERNEL_SETTINGS } from '@bemmoly/core-web';
import type { MeResponse } from '@bemmoly/shared';
import { createRoute, lazyRouteComponent, redirect } from '@tanstack/react-router';
import { viewerOf } from '../lib/session.ts';
import { appRoute } from './app-routes.tsx';

/** First settings page this person may open: people managers land on Users. */
function firstPage(me: MeResponse): string {
  const items = flattenSettings(buildSettingsNav([], viewerOf(me)));
  return (items.find((item) => item.id === 'users') ?? items[0])?.path ?? '/';
}

/** What a page needs; null (everyone signed in, Profile and Notifications) must stay null. */
function requirement(id: string) {
  const item = KERNEL_SETTINGS.flatMap((group) => group.items).find((entry) => entry.id === id);
  return item ? item.requires : 'admin';
}

function guard(id: string) {
  return ({ context }: { context: { me: MeResponse } }) => {
    if (!canOpen(requirement(id), viewerOf(context.me))) {
      throw redirect({ to: firstPage(context.me) });
    }
  };
}

export const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'settings',
  component: lazyRouteComponent(
    () => import('../pages/settings/settings-layout.tsx'),
    'SettingsLayout',
  ),
});

const settingsIndexRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/',
  beforeLoad: ({ context }) => {
    throw redirect({ to: firstPage(context.me) });
  },
});

type PageModule = Record<string, unknown>;

function page<const P extends string>(
  id: string,
  path: P,
  load: () => Promise<PageModule>,
  exportName: string,
) {
  return createRoute({
    getParentRoute: () => settingsRoute,
    path,
    beforeLoad: guard(id),
    component: lazyRouteComponent(
      load as () => Promise<Record<string, never>>,
      exportName as never,
    ),
  });
}

const pages = [
  page('profile', 'profile', () => import('../pages/settings/profile-page.tsx'), 'ProfilePage'),
  page(
    'access-tokens',
    'access-tokens',
    () => import('../pages/settings/access-tokens-page.tsx'),
    'AccessTokensPage',
  ),
  page(
    'notifications',
    'notifications',
    () => import('../pages/settings/notifications-page.tsx'),
    'NotificationPreferencesPage',
  ),
  page(
    'workspace',
    'workspace',
    () => import('../pages/settings/workspace-page.tsx'),
    'WorkspacePage',
  ),
  page(
    'appearance',
    'appearance',
    () => import('../pages/settings/appearance-page.tsx'),
    'AppearancePage',
  ),
  // Anyone signed in may open the editor: it offers personal themes when the workspace allows.
  page(
    'profile',
    'appearance/themes/new',
    () => import('../pages/settings/custom-theme-page.tsx'),
    'CustomThemePage',
  ),
  page(
    'profile',
    'appearance/themes/$themeId',
    () => import('../pages/settings/custom-theme-page.tsx'),
    'CustomThemePage',
  ),
  page('email', 'email', () => import('../pages/settings/email-page.tsx'), 'EmailPage'),
  page('ai', 'ai', () => import('../pages/settings/ai/ai-setup-page.tsx'), 'AiSetupPage'),
  page(
    'ai',
    'ai/privacy',
    () => import('../pages/settings/ai/ai-privacy-page.tsx'),
    'AiPrivacyPage',
  ),
  page('ai', 'ai/usage', () => import('../pages/settings/ai/ai-usage-page.tsx'), 'AiUsagePage'),
  page(
    'ai',
    'ai/prompts',
    () => import('../pages/settings/ai/ai-prompts-page.tsx'),
    'AiPromptsPage',
  ),
  page('mcp', 'mcp', () => import('../pages/settings/mcp-page.tsx'), 'McpPage'),
  page('users', 'users', () => import('../pages/settings/users-page.tsx'), 'UsersPage'),
  page('teams', 'teams', () => import('../pages/settings/teams-page.tsx'), 'TeamsPage'),
  page('roles', 'roles', () => import('../pages/settings/roles-page.tsx'), 'RolesPage'),
  page(
    'authentication',
    'authentication',
    () => import('../pages/settings/authentication-page.tsx'),
    'AuthenticationPage',
  ),
  page('modules', 'modules', () => import('../pages/settings/modules-page.tsx'), 'ModulesPage'),
  page('import', 'import', () => import('../pages/settings/import-page.tsx'), 'ImportPage'),
  page(
    'code-hosts',
    'code-hosts',
    () => import('../pages/settings/code-hosts-page.tsx'),
    'CodeHostsPage',
  ),
  page('backups', 'backups', () => import('../pages/settings/backups-page.tsx'), 'BackupsPage'),
  page('updates', 'updates', () => import('../pages/settings/updates-page.tsx'), 'UpdatesPage'),
  page('system', 'system', () => import('../pages/settings/system-page.tsx'), 'SystemPage'),
  page(
    'audit-log',
    'audit-log',
    () => import('../pages/settings/audit-log-page.tsx'),
    'AuditLogPage',
  ),
];

/** Settings panels contributed by modules render inside the frame from their manifests. */
const moduleSettingsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '$',
  component: lazyRouteComponent(
    () => import('../pages/settings/module-settings-page.tsx'),
    'ModuleSettingsPage',
  ),
});

export const settingsTree = settingsRoute.addChildren([
  settingsIndexRoute,
  ...pages,
  moduleSettingsRoute,
]);
