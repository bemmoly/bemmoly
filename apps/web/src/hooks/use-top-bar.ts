import type { NavEntry } from '@bemmoly/shared';
import { THEMES } from '@bemmoly/ui/tokens';
import { useNavigate } from '@tanstack/react-router';
import type { DropdownItem } from '../ui.ts';
import { useThemeStore } from '../store/theme.ts';
import { useUiStore } from '../store/ui.ts';
import { useDevMailbox } from './use-dev-mailbox.ts';
import { useNavEntries } from './use-modules.ts';
import { useMe, useSignOut } from './use-session.ts';
import { useWorkspace } from './use-workspace.ts';

export const PEOPLE_PATHS = [
  '/settings/users',
  '/settings/teams',
  '/settings/roles',
  '/settings/authentication',
];

/** Everything the top bar shows, derived from the manifest, the session and the policy. */
export function useTopBar() {
  const me = useMe();
  const navigate = useNavigate();
  const go = (to: string) => () => void navigate({ to });
  const topEntries = useNavEntries('top');
  const createEntries = useNavEntries('create');
  const requestInvite = useUiStore((state) => state.requestInvite);
  const signOut = useSignOut();
  const devMailbox = useDevMailbox(me.can('workspace.email.manage'));
  const { mode, preset, setMode, setPreset } = useThemeStore();
  const workspace = useWorkspace();
  const policy = workspace.appearance.policy;
  const admin = me.isAdmin;
  const people = me.can('workspace.roles.manage');

  const peopleItems: DropdownItem[] = people
    ? [
        { id: 'users', label: 'Users', onSelect: go('/settings/users') },
        { id: 'teams', label: 'Teams', onSelect: go('/settings/teams') },
        { id: 'roles', label: 'Roles and permissions', onSelect: go('/settings/roles') },
      ]
    : [];

  const createItems: DropdownItem[] = [
    ...createEntries.map((entry: NavEntry) => ({
      id: entry.id,
      label: entry.label,
      onSelect: go(entry.path),
    })),
    ...(people
      ? [
          {
            id: 'invite',
            label: 'Invite people',
            onSelect: () => {
              requestInvite(true);
              void navigate({ to: '/settings/users' });
            },
          },
          { id: 'team', label: 'Team', onSelect: go('/settings/teams') },
        ]
      : []),
  ];

  const tick = (on: boolean) => (on ? '✓' : undefined);
  const themeItems: DropdownItem[] = [
    ...(policy.memberModeSwitch
      ? (['system', 'light', 'dark'] as const).map((value) => ({
          id: `mode-${value}`,
          label: value === 'system' ? 'Workspace default' : value === 'light' ? 'Light' : 'Dark',
          hint: tick(mode === value && !preset),
          onSelect: () => {
            setPreset(null);
            setMode(value);
          },
        }))
      : []),
    ...(policy.personalThemes
      ? THEMES.map((theme) => ({
          id: `preset-${theme.id}`,
          label: theme.name,
          hint: tick(preset === theme.id),
          onSelect: () => setPreset(theme.id),
        }))
      : []),
    ...(me.can('workspace.appearance.manage')
      ? [{ id: 'appearance', label: 'Workspace appearance…', onSelect: go('/settings/appearance') }]
      : []),
  ];

  const accountItems: DropdownItem[] = [
    { id: 'settings', label: admin ? 'Workspace settings' : 'Settings', onSelect: go('/settings') },
    {
      id: 'notifications',
      label: 'Notification preferences',
      onSelect: go('/settings/notifications'),
    },
    ...(devMailbox.enabled
      ? [{ id: 'mailbox', label: 'Dev mailbox', onSelect: go('/dev/mailbox') }]
      : []),
    { id: 'sign-out', label: 'Sign out', onSelect: () => signOut.mutate() },
  ];

  return { me, workspace, topEntries, peopleItems, createItems, themeItems, accountItems };
}
