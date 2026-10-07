import { isApiError, queryKeys } from '@bemmoly/api-client';
import { groupItems, rankItems } from '@bemmoly/core-web';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useDeferredValue, useMemo, useState } from 'react';
import { api } from '../lib/api.ts';
import { viewerOf } from '../lib/session.ts';
import { useThemeStore } from '../store/theme.ts';
import { useUiStore, type PaletteScope } from '../store/ui.ts';
import { paletteItems, type PaletteItem } from './command-items.ts';
import { useDirectory } from './use-directory.ts';
import { useModules } from './use-modules.ts';
import { useMe, useSignOut } from './use-session.ts';

export const SCOPES: ReadonlyArray<{ value: PaletteScope; label: string; group?: string }> = [
  { value: 'all', label: 'All' },
  { value: 'people', label: 'People', group: 'People' },
  { value: 'settings', label: 'Settings', group: 'Settings' },
  { value: 'actions', label: 'Actions', group: 'Actions' },
];

/** The Command mock's rule: a sentence that starts with a verb is a request, not a search. */
const COMMAND = /^(move|assign|close|set|change|reopen|add|remove|rename)\b/;

/** Server search when the server has it; a 404 means "not yet" and the directory still answers. */
function useServerSearch(q: string) {
  return useQuery({
    queryKey: queryKeys.search(q, ['user']),
    queryFn: async () => {
      try {
        return (await api.search({ q, kinds: ['user'], limit: 8 })).items;
      } catch (error) {
        if (isApiError(error) && error.code === 'not_found') return [];
        throw error;
      }
    },
    enabled: q.length >= 2,
    placeholderData: keepPreviousData,
  });
}

export function useCommandPalette() {
  const me = useMe();
  const navigate = useNavigate();
  const ui = useUiStore();
  const setMode = useThemeStore((state) => state.setMode);
  const signOut = useSignOut();
  const { data: modules = [] } = useModules();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<PaletteScope>(ui.paletteScope);
  const deferred = useDeferredValue(query.trim());
  const canManagePeople = me.can('workspace.roles.manage');
  const { directory } = useDirectory(canManagePeople);
  const server = useServerSearch(deferred);

  const items = useMemo(
    () =>
      paletteItems({
        viewer: viewerOf(me),
        canManagePeople,
        modules,
        users: directory.users,
        searchHits: server.data ?? [],
        run: {
          invite: () => ui.requestInvite(true),
          inbox: () => ui.setInboxOpen(true),
          mode: setMode,
          signOut: () => signOut.mutate(),
        },
      }),
    [me, canManagePeople, modules, directory, server.data, ui, setMode, signOut],
  );

  const group = SCOPES.find((entry) => entry.value === scope)?.group;
  const groups = useMemo(() => {
    const scoped = group ? items.filter((item) => item.group === group) : items;
    const ranked = rankItems(deferred, scoped);
    const shown = deferred ? ranked : ranked.filter((item) => item.group !== 'People' || group);
    return groupItems(shown.slice(0, 30));
  }, [items, group, deferred]);

  const open = (item: PaletteItem) => {
    ui.closePalette();
    if (item.group === 'People') ui.setUserSearch(item.title);
    item.run?.();
    if (item.href) void navigate({ to: item.href });
  };

  return {
    query,
    setQuery,
    scope,
    setScope,
    groups,
    open,
    close: ui.closePalette,
    isCommand: COMMAND.test(query.trim().toLowerCase()),
  };
}
