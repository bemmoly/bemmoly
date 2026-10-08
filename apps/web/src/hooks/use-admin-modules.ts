import { queryKeys } from '@bemmoly/api-client';
import type { AdminModule, ModuleAccessChoice } from '@bemmoly/shared';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api.ts';
import { describeError } from '../lib/errors.ts';
import { toast } from '../lib/toast.ts';
import { accessSummary, useAccessChoice } from './use-module-access-choice.ts';

export const adminModulesQuery = queryOptions({
  queryKey: queryKeys.adminModules(),
  queryFn: () => api.adminModules.list(),
});

/** Manifests carry no display name for the admin list yet, so the id stands in. */
export const moduleName = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);

/** Removing data needs the set unpinned, the module off, and its id typed back exactly. */
export function canRemoveData(module: AdminModule, typed: string, pinned: boolean): boolean {
  return !pinned && !module.enabled && typed.trim() === module.id;
}

export type ModuleDialogKind = 'enable' | 'disable' | 'remove';

export type ModuleDialog = { kind: ModuleDialogKind; id: string } | null;

/**
 * Settings › Modules: every module in the image, enable (after asking who may use
 * it) and disable, and the separate, typed confirmation for removing a disabled
 * module's data. Both
 * module queries are refreshed so the top bar navigation follows at once.
 */
export function useAdminModules() {
  const queryClient = useQueryClient();
  const query = useQuery(adminModulesQuery);
  const [dialog, setDialog] = useState<ModuleDialog>(null);
  const [typed, setTyped] = useState('');
  const access = useAccessChoice();

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.modules() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.adminModules() }),
    ]);
  const onError = (error: unknown) => {
    toast(describeError(error).message, 'danger');
    void refresh();
  };

  const setEnabled = useMutation({
    mutationFn: async (change: { id: string; enabled: boolean; access?: ModuleAccessChoice }) => {
      if (change.enabled) await api.adminModules.enable(change.id, change.access);
      else await api.adminModules.disable(change.id);
    },
    onSuccess: async (_, { id, enabled, access: choice }) => {
      await Promise.all([
        refresh(),
        queryClient.invalidateQueries({ queryKey: queryKeys.moduleGrants() }),
      ]);
      setDialog(null);
      const name = modules.find((module) => module.id === id)?.name ?? moduleName(id);
      toast(
        enabled
          ? `${name} enabled: ${accessSummary(choice ?? { mode: 'none' }, access.teams)}`
          : `${name} disabled`,
      );
    },
    onError,
  });

  const removeData = useMutation({
    mutationFn: ({ id, confirm }: { id: string; confirm: string }) =>
      api.adminModules.removeData(id, confirm),
    onSuccess: async (_, { id }) => {
      await refresh();
      setDialog(null);
      toast(`${moduleName(id)} data removed`);
    },
  });

  const modules = query.data?.items ?? [];
  const pinned = query.data?.pinned ?? false;
  const target = modules.find((module) => module.id === dialog?.id) ?? null;

  const open = (kind: ModuleDialogKind, id: string) => {
    setTyped('');
    removeData.reset();
    access.reset();
    setDialog({ kind, id });
  };

  return {
    ...query,
    modules,
    pinned,
    restartPending: modules.filter((module) => module.restartRequired),
    setEnabled,
    removeData,
    access,
    dialog: {
      kind: dialog?.kind ?? null,
      target,
      typed,
      setTyped,
      open,
      close: () => setDialog(null),
      canRemove: target ? canRemoveData(target, typed, pinned) : false,
    },
  };
}
