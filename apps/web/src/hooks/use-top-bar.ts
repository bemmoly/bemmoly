import type { TopBarNavItem } from '@bemmoly/ui';
import { PRESETS } from '@bemmoly/ui/tokens';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useState } from 'react';
import { useThemeStore } from '../store/theme.ts';
import { useUiStore } from '../store/ui.ts';
import { useDevMailbox } from './use-dev-mailbox.ts';
import { useNavEntries } from './use-modules.ts';
import { useInbox } from './use-notifications.ts';
import { useMe, useSignOut } from './use-session.ts';
import { useWorkspace } from './use-workspace.ts';

export interface MenuEntry {
  id: string;
  label: string;
  hint?: string;
  onSelect: () => void;
}

const PEOPLE_PATHS = [
  '/settings/users',
  '/settings/teams',
  '/settings/roles',
  '/settings/authentication',
];

/**
 * Everything the top bar shows, derived from the module manifest, the
 * session, the inbox and the appearance policy. "Create" opens ⌘K on its
 * Actions, where the create entries live; "Teams" goes to the People pages.
 */
export function useTopBar() {
  const me = useMe();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const go = (to: string) => () => void navigate({ to });
  const topEntries = useNavEntries('top');
  const openPalette = useUiStore((state) => state.openPalette);
  const setInboxOpen = useUiStore((state) => state.setInboxOpen);
  const inboxOpen = useUiStore((state) => state.inboxOpen);
  const { unreadCount } = useInbox();
  const signOut = useSignOut();
  const devMailbox = useDevMailbox(me.can('workspace.email.manage'));
  const { mode, preset, setMode, setPreset } = useThemeStore();
  const workspace = useWorkspace();
  const [accountOpen, setAccountOpen] = useState(false);
  const policy = workspace.appearance.policy;

  const nav: TopBarNavItem[] = [
    { id: 'your-work', label: 'Your work', href: '/', active: pathname === '/' },
    ...topEntries.map((entry) => ({
      id: entry.id,
      label: entry.label,
      href: entry.path,
      active: pathname === entry.path || pathname.startsWith(`${entry.path}/`),
    })),
    ...(me.can('workspace.roles.manage')
      ? [
          {
            id: 'teams',
            label: 'Teams',
            href: '/settings/teams',
            active: PEOPLE_PATHS.some((path) => pathname.startsWith(path)),
          },
        ]
      : []),
  ];

  const tick = (on: boolean) => (on ? '✓' : undefined);
  const themeItems: MenuEntry[] = [
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
      ? PRESETS.map((entry) => ({
          id: `preset-${entry.id}`,
          label: entry.name,
          hint: tick(preset === entry.id),
          onSelect: () => setPreset(entry.id),
        }))
      : []),
    ...(me.can('workspace.appearance.manage')
      ? [{ id: 'appearance', label: 'Workspace appearance…', onSelect: go('/settings/appearance') }]
      : []),
  ];

  const accountItems: MenuEntry[] = [
    {
      id: 'settings',
      label: me.isAdmin ? 'Workspace settings' : 'Settings',
      onSelect: go('/settings'),
    },
    {
      id: 'notifications',
      label: 'Notification preferences',
      onSelect: go('/settings/notifications'),
    },
    { id: 'inbox', label: 'Inbox', onSelect: go('/inbox') },
    ...(devMailbox.enabled
      ? [{ id: 'mailbox', label: 'Dev mailbox', onSelect: go('/dev/mailbox') }]
      : []),
    { id: 'sign-out', label: 'Sign out', onSelect: () => signOut.mutate() },
  ];

  return {
    me,
    workspace,
    nav,
    themeItems,
    accountItems,
    unreadCount,
    accountOpen,
    setAccountOpen,
    onCreate: () => openPalette('actions'),
    onSearch: () => openPalette('all'),
    onInbox: () => setInboxOpen(!inboxOpen),
  };
}
