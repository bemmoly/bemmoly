import { isApiError, queryKeys } from '@bemmoly/api-client';
import {
  buildSettingsNav,
  flattenSettings,
  groupItems,
  rankItems,
  useListNavigation,
  type CommandItem,
} from '@bemmoly/core-web';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { api } from '../lib/api.ts';
import { useThemeStore } from '../store/theme.ts';
import { useUiStore } from '../store/ui.ts';
import { viewerOf } from '../lib/session.ts';
import { useDirectory } from './use-directory.ts';
import { useModules } from './use-modules.ts';
import { useMe, useSignOut } from './use-session.ts';

export type PaletteScope = 'all' | 'people' | 'settings' | 'actions';

export const SCOPES: ReadonlyArray<{ id: PaletteScope; label: string; group?: string }> = [
  { id: 'all', label: 'All' },
  { id: 'people', label: 'People', group: 'People' },
  { id: 'settings', label: 'Settings', group: 'Settings' },
  { id: 'actions', label: 'Actions', group: 'Actions' },
];

/** The Command mock's rule: a sentence that starts with a verb is a request, not a search. */
const COMMAND = /^(move|assign|create|close|set|change|reopen|add|remove|rename)\b/;

interface PaletteItem extends CommandItem {
  run?: () => void;
}

export function useCommandPalette() {
  const me = useMe();
  const navigate = useNavigate();
  const close = useUiStore((state) => state.closePalette);
  const setUserSearch = useUiStore((state) => state.setUserSearch);
  const requestInvite = useUiStore((state) => state.requestInvite);
  const setInboxOpen = useUiStore((state) => state.setInboxOpen);
  const setMode = useThemeStore((state) => state.setMode);
  const signOut = useSignOut();
  const { data: modules = [] } = useModules();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<PaletteScope>('all');
  const deferred = useDeferredValue(query.trim());
  const admin = me.can('workspace.roles.manage');

  const users = useDirectory(admin);
  const server = useQuery({
    queryKey: queryKeys.search(deferred, ['user']),
    queryFn: async () => {
      try {
        return (await api.search({ q: deferred, kinds: ['user'], limit: 8 })).items;
      } catch (error) {
        if (isApiError(error) && error.code === 'not_found') return [];
        throw error;
      }
    },
    enabled: deferred.length >= 2,
    placeholderData: keepPreviousData,
  });

  const items = useMemo<PaletteItem[]>(() => {
    const viewer = viewerOf(me);
    const settings = flattenSettings(buildSettingsNav(modules, viewer)).map((entry) => ({
      id: `setting:${entry.id}`,
      group: 'Settings',
      title: entry.label,
      subtitle: 'Settings',
      keywords: entry.id.split('-'),
      href: entry.path,
    }));
    const people = new Map<string, PaletteItem>();
    for (const user of users.directory.users) {
      people.set(user.id, {
        id: `user:${user.id}`,
        group: 'People',
        title: user.name,
        subtitle: user.email,
        href: '/settings/users',
      });
    }
    for (const hit of server.data ?? []) {
      if (!people.has(hit.id)) {
        people.set(hit.id, {
          id: `user:${hit.id}`,
          group: 'People',
          title: hit.title,
          subtitle: hit.subtitle ?? undefined,
          href: hit.href,
        });
      }
    }
    const goTo = modules.flatMap((module) =>
      module.navigation
        .filter((entry) => entry.placement === 'command' || entry.placement === 'top')
        .map((entry) => ({
          id: `go:${entry.id}`,
          group: 'Actions',
          title: `Go to ${entry.label}`,
          href: entry.path,
        })),
    );
    const actions: PaletteItem[] = [
      ...(admin
        ? [
            {
              id: 'invite',
              group: 'Actions',
              title: 'Invite people',
              keywords: ['user', 'email'],
              href: '/settings/users',
              run: () => requestInvite(true),
            },
          ]
        : []),
      {
        id: 'inbox',
        group: 'Actions',
        title: 'Open inbox',
        keywords: ['notifications'],
        href: '',
        run: () => setInboxOpen(true),
      },
      {
        id: 'dark',
        group: 'Actions',
        title: 'Switch to dark mode',
        keywords: ['theme'],
        href: '',
        run: () => setMode('dark'),
      },
      {
        id: 'light',
        group: 'Actions',
        title: 'Switch to light mode',
        keywords: ['theme'],
        href: '',
        run: () => setMode('light'),
      },
      ...goTo,
      {
        id: 'sign-out',
        group: 'Actions',
        title: 'Sign out',
        keywords: ['log out'],
        href: '',
        run: () => signOut.mutate(),
      },
    ];
    return [...people.values(), ...settings, ...actions];
  }, [
    admin,
    me,
    modules,
    users.directory,
    server.data,
    requestInvite,
    setInboxOpen,
    setMode,
    signOut,
  ]);

  const group = SCOPES.find((entry) => entry.id === scope)?.group;
  const visible = useMemo(() => {
    const scoped = group ? items.filter((item) => item.group === group) : items;
    const ranked = rankItems(deferred, scoped);
    return deferred
      ? ranked.slice(0, 30)
      : ranked.filter((item) => item.group !== 'People' || group).slice(0, 30);
  }, [items, group, deferred]);
  const groups = useMemo(() => groupItems(visible), [visible]);

  const open = useCallback(
    (index: number) => {
      const item = visible[index];
      if (!item) return;
      close();
      if (item.group === 'People') setUserSearch(item.title);
      item.run?.();
      if (item.href) void navigate({ to: item.href });
    },
    [visible, close, navigate, setUserSearch],
  );

  const navigation = useListNavigation(visible.length, `${scope}\n${deferred}`, open);
  const isCommand = COMMAND.test(query.trim().toLowerCase());
  return { query, setQuery, scope, setScope, groups, visible, open, navigation, isCommand, close };
}
