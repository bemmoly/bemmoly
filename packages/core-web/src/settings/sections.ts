import type { ModuleManifest } from '@bemmoly/shared';
import type { IconName } from '@bemmoly/ui/icons';

/** A capability name, "admin" (org admins only), or null (everyone signed in). */
export type SettingsRequirement = string | 'admin' | null;

export interface SettingsItem {
  id: string;
  label: string;
  path: string;
  requires: SettingsRequirement;
  icon: IconName;
  /** A module's settings row: its tile is drawn in place of the icon. */
  moduleId?: string;
  count?: number;
  /** A short accent badge, such as the version an update would bring. */
  badge?: string;
}

export interface SettingsGroup {
  id: string;
  label: string;
  items: SettingsItem[];
}

const item = (
  id: string,
  label: string,
  path: string,
  icon: IconName,
  requires: SettingsRequirement,
): SettingsItem => ({ id, label, path, icon, requires });

const PEOPLE = 'workspace.roles.manage';
const SETTINGS = 'workspace.settings.manage';
const SYSTEM = 'workspace.system.manage';
const MODULES = 'workspace.modules.manage';

/**
 * The kernel's settings pages in the design review's order (docs/design/premium/kit.js,
 * `settingsSidebar`): Account is everyone's own, then Workspace, People, Modules and System.
 * Each enabled module's settings join the Modules group from its manifest.
 */
export const KERNEL_SETTINGS: readonly SettingsGroup[] = [
  {
    id: 'account',
    label: 'Account',
    items: [
      item('profile', 'Profile', '/settings/profile', 'me', null),
      item('notifications', 'Notifications', '/settings/notifications', 'bell', null),
    ],
  },
  {
    id: 'workspace',
    label: 'Workspace',
    items: [
      item('workspace', 'General', '/settings/workspace', 'building', SETTINGS),
      item(
        'appearance',
        'Appearance',
        '/settings/appearance',
        'palette',
        'workspace.appearance.manage',
      ),
      item('email', 'Email delivery', '/settings/email', 'mail', 'workspace.email.manage'),
      item('ai', 'AI and models', '/settings/ai', 'spark', 'ai.models.configure'),
    ],
  },
  {
    id: 'people',
    label: 'People',
    items: [
      item('users', 'Members', '/settings/users', 'people', PEOPLE),
      item('teams', 'Teams', '/settings/teams', 'people', PEOPLE),
      item('roles', 'Roles', '/settings/roles', 'shield', PEOPLE),
      item(
        'authentication',
        'Sign-in and SSO',
        '/settings/authentication',
        'key',
        'workspace.sso.configure',
      ),
    ],
  },
  {
    id: 'modules',
    label: 'Modules',
    items: [item('modules', 'Manage modules', '/settings/modules', 'modules', MODULES)],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      item('backups', 'Storage and backups', '/settings/backups', 'database', SYSTEM),
      item('updates', 'Updates', '/settings/updates', 'download', SYSTEM),
      item('system', 'System status', '/settings/system', 'pulse', SYSTEM),
      item('audit-log', 'Audit log', '/settings/audit-log', 'clock', 'workspace.audit.view'),
    ],
  },
];

export interface SettingsViewer {
  isAdmin: boolean;
  capabilities: readonly string[];
}

export function canOpen(requires: SettingsRequirement, viewer: SettingsViewer): boolean {
  if (requires === null || viewer.isAdmin) return true;
  if (requires === 'admin') return false;
  return viewer.capabilities.includes(requires);
}

const moduleName = (manifest: ModuleManifest) =>
  manifest.name ?? manifest.id.charAt(0).toUpperCase() + manifest.id.slice(1);

/**
 * One row per enabled module, in sidebar order: its own settings pages when it registers
 * any, otherwise its row in Settings › Modules.
 */
function moduleItems(manifests: readonly ModuleManifest[]): SettingsItem[] {
  const ordered = [...manifests].sort((a, b) => (a.order ?? 50) - (b.order ?? 50));
  return ordered.flatMap((manifest) => {
    const entries = manifest.navigation.filter((entry) => entry.placement === 'settings');
    const icon = (manifest.icon ?? 'modules') as IconName;
    if (entries.length === 0) {
      return [
        {
          ...item(
            `module:${manifest.id}`,
            moduleName(manifest),
            `/settings/modules#${manifest.id}`,
            icon,
            MODULES,
          ),
          moduleId: manifest.id,
        },
      ];
    }
    return entries.map((entry) => ({
      ...item(
        entry.id,
        entries.length === 1 ? moduleName(manifest) : entry.label,
        entry.path,
        icon,
        'admin',
      ),
      moduleId: manifest.id,
    }));
  });
}

/** Per-item extras the shell knows: counts (members) and badges (an update's version). */
export interface SettingsDecorations {
  counts?: Readonly<Record<string, number>>;
  badges?: Readonly<Record<string, string>>;
}

/** The settings sidebar for this viewer: kernel groups, with each module's row under Modules. */
export function buildSettingsNav(
  manifests: readonly ModuleManifest[],
  viewer: SettingsViewer,
  decorations: SettingsDecorations = {},
): SettingsGroup[] {
  const { counts = {}, badges = {} } = decorations;
  return KERNEL_SETTINGS.map((group) =>
    group.id === 'modules'
      ? { ...group, items: [...moduleItems(manifests), ...group.items] }
      : group,
  )
    .map((group) => ({
      ...group,
      items: group.items
        .filter((entry) => canOpen(entry.requires, viewer))
        .map((entry) => ({
          ...entry,
          ...(counts[entry.id] === undefined ? {} : { count: counts[entry.id] }),
          ...(badges[entry.id] === undefined ? {} : { badge: badges[entry.id] }),
        })),
    }))
    .filter((group) => group.items.length > 0);
}

/** Flat list for ⌘K and for "first page this viewer may open". */
export function flattenSettings(groups: readonly SettingsGroup[]): SettingsItem[] {
  return groups.flatMap((group) => group.items);
}

/** The group and item a settings path belongs to, for the header's breadcrumbs. */
export function settingsTrail(
  groups: readonly SettingsGroup[],
  pathname: string,
): { group: SettingsGroup; item: SettingsItem } | null {
  for (const group of groups) {
    const found = group.items.find(
      (entry) =>
        !entry.path.includes('#') &&
        (pathname === entry.path || pathname.startsWith(`${entry.path}/`)),
    );
    if (found) return { group, item: found };
  }
  return null;
}
