import { queryKeys } from '@bemmoly/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.ts';
import { describeError } from '../lib/errors.ts';
import { toast } from '../lib/toast.ts';
import { adminModulesQuery } from './use-admin-modules.ts';

/** The modules a fresh install turns on in one step, in this order (Docs links to Work). */
export const STARTER_MODULES = ['work', 'docs'] as const;

export const STARTER_DONE_MESSAGE =
  'Work and Docs are on. Only admins can open them until you grant access.';

/**
 * One step from an empty install to a working one: turns on Work, then Docs, with nobody
 * granted yet, so the admin decides who gets in afterwards. Offered only to someone who may
 * manage modules, and not while the image pins the module set (`available` is false then).
 */
export function useStarterModules(canManage: boolean) {
  const queryClient = useQueryClient();
  const admin = useQuery({ ...adminModulesQuery, enabled: canManage });
  const items = admin.data?.items ?? [];
  const toTurnOn = STARTER_MODULES.filter((id) =>
    items.some((module) => module.id === id && !module.enabled),
  );

  const turnOn = useMutation({
    mutationFn: async () => {
      for (const id of toTurnOn) await api.adminModules.enable(id, { mode: 'none' });
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.modules() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.adminModules() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.moduleGrants() }),
      ]),
    onSuccess: () => toast(STARTER_DONE_MESSAGE),
    onError: (error) => toast(describeError(error).message, 'danger'),
  });

  return {
    available: canManage && admin.isSuccess && !admin.data.pinned && toTurnOn.length > 0,
    turnOn: () => turnOn.mutate(),
    pending: turnOn.isPending,
  };
}
