import type { ModuleManifest } from '@bemmoly/shared';

export interface SettingsItem {
  id: string;
  label: string;
  path: string;
  /** Shown only to org admins, or to people holding `capability`. */
  adminOnly: boolean;
  capability?: string;
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
  options: Partial<Pick<SettingsItem, 'adminOnly' | 'capability'>> = {},
): SettingsItem => ({ id, label, path, adminOnly: options.adminOnly ?? true, ...options });

/**
 * The kernel's settings pages, in the order of the People and Appearance mocks'
 * sidebar. Modules, Storage and backups, Updates and System status are the
 * queued additions to the System group; Personal is where anyone manages their
 * own notifications. Module groups (Work's issue types, workflows, automation)
 * are inserted before System from the manifests.
 */
export const KERNEL_SETTINGS: readonly SettingsGroup[] = [
  {
    id: 'personal',
    label: 'Personal',
    items: [
      item('notifications', 'Notifications', '/settings/notifications', { adminOnly: false }),
    ],
  },
  {
    id: 'general',
    label: 'General',
    items: [
      item('workspace', 'Workspace details', '/settings/workspace'),
      item('appearance', 'Appearance', '/settings/appearance', {
        capability: 'workspace.appearance.manage',
      }),
      item('email', 'Email and notifications', '/settings/email'),
      item('ai', 'AI and models', '/settings/ai', { capability: 'ai.models.configure' }),
    ],
  },
  {
    id: 'people',
    label: 'People',
    items: [
      item('users', 'Users', '/settings/users'),
      item('teams', 'Teams', '/settings/teams'),
      item('roles', 'Roles and permissions', '/settings/roles', {
        capability: 'workspace.roles.manage',
      }),
      item('authentication', 'Authentication (SSO)', '/settings/authentication', {
        capability: 'workspace.sso.configure',
      }),
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      item('modules', 'Modules', '/settings/modules'),
      item('backups', 'Storage and backups', '/settings/backups'),
      item('updates', 'Updates', '/settings/updates'),
      item('system', 'System status', '/settings/system'),
      item('audit-log', 'Audit log', '/settings/audit-log'),
    ],
  },
];

export interface SettingsViewer {
  isAdmin: boolean;
  capabilities: readonly string[];
}

function visible(entry: SettingsItem, viewer: SettingsViewer): boolean {
  if (!entry.adminOnly || viewer.isAdmin) return true;
  return entry.capability !== undefined && viewer.capabilities.includes(entry.capability);
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
        items: entries.map((entry) => item(entry.id, entry.label, entry.path)),
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
        .filter((entry) =>
          group.id.startsWith('module:') ? viewer.isAdmin : visible(entry, viewer),
        )
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
