import { hasErrorCode, queryKeys } from '@bemmoly/api-client';
import type { ReleaseChannel, RollbackMode } from '@bemmoly/shared';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api.ts';
import { describeError } from '../lib/errors.ts';
import { toast } from '../lib/toast.ts';
import { useSettings } from './use-setting.ts';
import { MAINTENANCE_POLL_MS, useSystemMaintenance } from './use-system-maintenance.ts';
import { commandFrom } from './use-updates-copy.ts';

export const updatesQuery = queryOptions({
  queryKey: queryKeys.updates(),
  queryFn: () => api.updates.overview(),
});

const KEYS = ['system.updates.channel', 'system.updates.check'] as const;

export type UpdateDialog = 'update' | 'rollback' | null;

/**
 * Settings › Updates: the running version, the channel and daily check, the
 * available release, and the rollback plan. Nothing runs until the admin
 * confirms in a dialog; while the updater works the overview is polled.
 */
export function useUpdates() {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<UpdateDialog>(null);
  /** The plan changed between showing the dialog and confirming it. */
  const [planChanged, setPlanChanged] = useState(false);
  const settings = useSettings(KEYS, 'Update settings saved');

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.updates() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.system() }),
    ]);

  const apply = useMutation({
    mutationFn: (version: string) => api.updates.apply(version),
    onSuccess: async () => {
      setDialog(null);
      await refresh();
    },
    onError: () => void refresh(),
  });

  const rollback = useMutation({
    mutationFn: (mode: RollbackMode) => api.updates.rollback(mode),
    onSuccess: async () => {
      setDialog(null);
      await refresh();
    },
    onError: (error) => {
      if (hasErrorCode(error, 'conflict')) setPlanChanged(true);
      void refresh();
    },
  });

  const upload = useMutation({
    mutationFn: (file: File) => api.updates.uploadBundle(file),
    onSuccess: async (stored) => {
      toast(`Uploaded ${stored.filename}`);
      await refresh();
    },
    onError: (error) => toast(describeError(error).message, 'danger'),
  });

  const maintenance = useSystemMaintenance([apply.error, rollback.error]);
  const query = useQuery({
    ...updatesQuery,
    refetchInterval: (current) =>
      current.state.data?.updater.state === 'running' ? MAINTENANCE_POLL_MS : maintenance.poll,
  });

  const save = (values: Parameters<typeof settings.save.mutate>[0]) =>
    settings.save.mutate(values, { onSuccess: () => void refresh() });

  const overview = query.data;
  return {
    ...query,
    overview,
    maintenance,
    running: overview?.updater.state === 'running',
    channel:
      settings.reads?.['system.updates.channel'].value ?? overview?.current.channel ?? 'stable',
    checkDaily: settings.reads?.['system.updates.check'].value ?? overview?.checks.enabled ?? true,
    setChannel: (channel: ReleaseChannel) => save({ 'system.updates.channel': channel }),
    setCheckDaily: (on: boolean) => save({ 'system.updates.check': on }),
    savingSettings: settings.save.isPending,
    apply,
    /** Set when the install has no updater: the command to run on the server instead. */
    cliCommand: commandFrom(apply.error),
    applyError: commandFrom(apply.error) ? null : apply.error,
    rollback,
    upload,
    planChanged,
    /** A restore rollback offers the audit rows it would discard as CSV. */
    auditExportUrl: (since: string) => api.audit.exportUrl({ since }),
    dialog: {
      kind: dialog,
      open: (kind: Exclude<UpdateDialog, null>) => {
        apply.reset();
        rollback.reset();
        setPlanChanged(false);
        setDialog(kind);
      },
      close: () => setDialog(null),
    },
  };
}
