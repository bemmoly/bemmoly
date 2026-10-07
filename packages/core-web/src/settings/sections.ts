import type { ModuleManifest } from '@bemmoly/shared';

/** A capability name, "admin" (org admins only), or null (everyone signed in). */
export type SettingsRequirement = string | 'admin' | null;

export interface SettingsItem {
  id: string;
  label: string;
  path: string;
  requires: SettingsRequirement;
  count?: number;
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
  requires: SettingsRequirement,
): SettingsItem => ({
  id,
  label,
  path,
  requires,
});

const PEOPLE = 'workspace.roles.manage';

/**
 * The kernel's settings pages, in the order of the People and Appearance mocks'
 * sidebar. Modules, Storage and backups, Updates and System status are the
 * queued additions to the System group; Personal is where anyone manages their
 * own notifications. Module groups are inserted before System from manifests.
 */
export const KERNEL_SETTINGS: readonly SettingsGroup[] = [
  {
    id: 'personal',
    label: 'Personal',
    items: [item('notifications', 'Notifications', '/settings/notifications', null)],
  },
  {
    id: 'general',
    label: 'General',
    items: [
      item('workspace', 'Workspace details', '/settings/workspace', 'admin'),
      item('appearance', 'Appearance', '/settings/appearance', 'workspace.appearance.manage'),
      item('email', 'Email and notifications', '/settings/email', 'workspace.email.manage'),
      item('ai', 'AI and models', '/settings/ai', 'ai.models.configure'),
    ],
  },
  {
    id: 'people',
    label: 'People',
    items: [
      item('users', 'Users', '/settings/users', PEOPLE),
      item('teams', 'Teams', '/settings/teams', PEOPLE),
      item('roles', 'Roles and permissions', '/settings/roles', PEOPLE),
      item(
        'authentication',
        'Authentication (SSO)',
        '/settings/authentication',
        'workspace.sso.configure',
      ),
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      item('modules', 'Modules', '/settings/modules', 'admin'),
      item('backups', 'Storage and backups', '/settings/backups', 'admin'),
      item('updates', 'Updates', '/settings/updates', 'admin'),
      item('system', 'System status', '/settings/system', 'admin'),
      item('audit-log', 'Audit log', '/settings/audit-log', 'workspace.audit.view'),
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

function moduleGroups(manifests: readonly ModuleManifest[]): SettingsGroup[] {
  return manifests.flatMap((manifest) => {
    const entries = manifest.navigation.filter((entry) => entry.placement === 'settings');
    if (entries.length === 0) return [];
    const top = manifest.navigation.find((entry) => entry.placement === 'top');
    const label = top?.label ?? manifest.id.charAt(0).toUpperCase() + manifest.id.slice(1);
    return [
      {
        id: `module:${manifest.id}`,
        label,
        items: entries.map((entry) => item(entry.id, entry.label, entry.path, 'admin')),
      },
    ];
  });
}

/** The sidebar for this viewer: kernel groups, then module groups before System. */
export function buildSettingsNav(
  manifests: readonly ModuleManifest[],
  viewer: SettingsViewer,
  counts: Readonly<Record<string, number>> = {},
): SettingsGroup[] {
  const kernel = KERNEL_SETTINGS.filter((group) => group.id !== 'system');
  const system = KERNEL_SETTINGS.filter((group) => group.id === 'system');
  return [...kernel, ...moduleGroups(manifests), ...system]
    .map((group) => ({
      ...group,
      items: group.items
        .filter((entry) => canOpen(entry.requires, viewer))
        .map((entry) =>
          counts[entry.id] === undefined ? entry : { ...entry, count: counts[entry.id] },
        ),
    }))
    .filter((group) => group.items.length > 0);
}

/** Flat list for ⌘K and for "first page this viewer may open". */
export function flattenSettings(groups: readonly SettingsGroup[]): SettingsItem[] {
  return groups.flatMap((group) => group.items);
}
