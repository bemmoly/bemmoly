import { queryKeys } from '@bemmoly/api-client';
import type { Role } from '@bemmoly/shared';
import { useToast } from '@bemmoly/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api } from '../../shared/index.ts';
import {
  actionGroups,
  allowedOf,
  isFixedRole,
  roleChanges,
  toggle,
  type Allowed,
  type RoleChange,
} from './action-matrix.ts';

const NONE: Allowed = {};

/**
 * Settings › Work › Permissions: the kernel's roles matrix, narrowed to the Work actions.
 * Toggles build a draft; Save writes one call per changed role, and everyone holding a
 * changed role is checked against the new cells from their next request.
 */
export function useActionMatrix() {
  const client = useQueryClient();
  const toast = useToast();
  const query = useQuery({
    queryKey: queryKeys.capabilities(),
    queryFn: () => api.capabilities(),
    retry: false,
  });
  const base = useMemo(() => (query.data ? allowedOf(query.data) : NONE), [query.data]);
  const groups = useMemo(() => (query.data ? actionGroups(query.data) : []), [query.data]);
  const roles = useMemo(() => query.data?.roles ?? [], [query.data]);
  const [draft, setDraft] = useState<Allowed | null>(null);
  const cells = draft ?? base;
  const changes = draft ? roleChanges(base, draft, roles, groups) : [];

  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.capabilities() }),
      client.invalidateQueries({ queryKey: queryKeys.me() }),
      client.invalidateQueries({ queryKey: queryKeys.work() }),
    ]);

  const save = useMutation({
    mutationFn: async (list: RoleChange[]) => {
      for (const change of list) await api.roles.saveCapabilities(change.roleId, change.items);
    },
    onSuccess: async () => {
      await refresh();
      setDraft(null);
      toast.show({ tone: 'ok', title: 'Permissions saved' });
    },
    onError: async (error) => {
      toast.show({ tone: 'danger', title: 'Permissions were not saved', body: error.message });
      await refresh();
    },
  });

  return {
    query,
    roles,
    groups,
    dirty: changes.length > 0,
    allowed: (action: string, roleId: string) => Boolean(cells[action]?.[roleId]),
    isFixed: isFixedRole,
    toggle: (action: string, role: Role) => setDraft(toggle(cells, action, role)),
    discard: () => setDraft(null),
    save,
    submit: () => {
      if (changes.length > 0) save.mutate(changes);
    },
  };
}

export type ActionMatrix = ReturnType<typeof useActionMatrix>;
