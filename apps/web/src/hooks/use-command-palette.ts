import { isApiError, queryKeys } from '@bemmoly/api-client';
import {
  groupItems,
  rankItems,
  useCurrentScreenActions,
  useRecents,
  type CommandGroup,
} from '@bemmoly/core-web';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useDeferredValue, useMemo, useState } from 'react';
import { api } from '../lib/api.ts';
import { viewerOf } from '../lib/session.ts';
import { useThemeStore } from '../store/theme.ts';
import { useUiStore, type PaletteScope } from '../store/ui.ts';
import { paletteItems, paletteScopes, recentItem, type PaletteItem } from './command-items.ts';
import { useDirectory } from './use-directory.ts';
import { useShell } from './use-shell.ts';

/** The Command mock's rule: a sentence that starts with a verb is a request, not a search. */
const COMMAND = /^(move|assign|close|set|change|reopen|add|remove|rename)\b/;

/** What the empty palette shows before anything is typed, per group. */
const EMPTY_LIMITS: Readonly<Record<string, number>> = { Recent: 5, Actions: 6, Navigation: 8 };

/**
 * Server search across every module search provider the person can reach;
 * a 404 (a server without the search route) means "nothing" and the
 * directory still answers for people.
 */
function useServerSearch(q: string) {
  return useQuery({
    queryKey: queryKeys.search(q),
    queryFn: async () => {
      try {
        return (await api.search({ q, limit: 8 })).items;
      } catch (error) {
        if (isApiError(error) && error.code === 'not_found') return [];
        throw error;
      }
    },
    enabled: q.length >= 2,
    placeholderData: keepPreviousData,
  });
}

/** The groups to show: the empty state's three, or everything ranked against the query. */
function arrange(
  items: readonly PaletteItem[],
  recents: readonly PaletteItem[],
  query: string,
  group: string | undefined,
): CommandGroup<PaletteItem>[] {
  const scoped = (list: readonly PaletteItem[]) =>
    group ? list.filter((item) => item.group === group) : list;
  if (!query) {
    if (group) {
      // A type filter with nothing typed: what was opened recently of that type, then the rest.
      const recentOfType = recents.filter((item) => item.kindGroup === group);
      return groupItems(
        [...recentOfType, ...scoped(items).filter((item) => !item.fromServer)].slice(0, 30),
      );
    }
    const shown = [
      ...recents.slice(0, EMPTY_LIMITS['Recent']),
      ...items.filter((item) => item.group === 'Actions').slice(0, EMPTY_LIMITS['Actions']),
      ...items.filter((item) => item.group === 'Navigation').slice(0, EMPTY_LIMITS['Navigation']),
    ];
    return groupItems(shown);
  }
  // Providers already matched and ranked their results; ⌘K ranks only its own items.
  const found = query.length >= 2 ? scoped(items).filter((item) => item.fromServer) : [];
  const ownRecents = group ? recents.filter((item) => item.kindGroup === group) : recents;
  const local = rankItems(query, [
    ...ownRecents,
    ...scoped(items).filter((item) => !item.fromServer),
  ]);
  const seen = new Set(found.map((item) => item.href));
  const unique = local.filter((item) => item.group !== 'Recent' || !seen.has(item.href));
  return groupItems([...found, ...unique.slice(0, 30)]);
}

export function useCommandPalette() {
  const shell = useShell();
  const navigate = useNavigate();
  const ui = useUiStore();
  const setMode = useThemeStore((state) => state.setMode);
  const screenActions = useCurrentScreenActions();
  const recents = useRecents(12);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<PaletteScope>(ui.paletteScope);
  const deferred = useDeferredValue(query.trim());
  const { directory } = useDirectory(shell.canInvite);
  const server = useServerSearch(deferred);
  const ai = shell.workspace.aiEnabled;

  const items = useMemo(
    () =>
      paletteItems({
        viewer: viewerOf(shell.me),
        canManagePeople: shell.canInvite,
        modules: shell.modules,
        users: directory.users,
        searchHits: server.data ?? [],
        screenActions,
        creates: shell.creates,
        run: {
          invite: () => ui.requestInvite(true),
          shortcuts: () => ui.setShortcutsOpen(true),
          mode: setMode,
          signOut: shell.signOut,
        },
      }),
    [shell, directory, server.data, screenActions, ui, setMode],
  );
  const recentItems = useMemo(() => recents.map(recentItem), [recents]);
  const scopes = useMemo(() => paletteScopes(shell.modules), [shell.modules]);
  const group = scopes.find((entry) => entry.value === scope)?.group;
  const groups = useMemo(
    () => arrange(items, recentItems, deferred, group),
    [items, recentItems, deferred, group],
  );

  const open = (item: PaletteItem) => {
    ui.closePalette();
    if (item.person) ui.setUserSearch(item.title);
    item.run?.();
    if (item.href) void navigate({ to: item.href });
  };

  /** Tab moves to the next type filter, Shift+Tab to the one before. */
  const cycleScope = (backwards: boolean) => {
    const index = scopes.findIndex((entry) => entry.value === scope);
    const next = scopes[(index + (backwards ? scopes.length - 1 : 1)) % scopes.length];
    if (next) setScope(next.value);
  };

  return {
    query,
    setQuery,
    scope,
    setScope,
    scopes,
    cycleScope,
    groups,
    open,
    ai,
    close: ui.closePalette,
    openShortcuts: () => ui.setShortcutsOpen(true),
    isCommand: ai && COMMAND.test(query.trim().toLowerCase()),
  };
}
