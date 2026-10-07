import { queryKeys } from '@bemmoly/api-client';
import type { UpdateChannel, UpdateStatus } from '@bemmoly/shared';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api.ts';
import { describeError } from '../lib/errors.ts';
import { toast } from '../lib/toast.ts';
import { useSettings } from './use-setting.ts';

/** While the updater works, the page polls its status this often. */
export const JOB_POLL_MS = 2000;

export const updatesQuery = queryOptions({
  queryKey: queryKeys.updates(),
  queryFn: () => api.updates.status(),
});

const KEYS = ['updates.channel', 'updates.checkForUpdates'] as const;

export type UpdateDialog = 'update' | 'rollback' | null;

/**
 * Settings › Updates: the running version, the channel, the latest release
 * with its notes, and rollback to the previous version. Nothing runs until the
 * admin confirms in a dialog.
 */
export function useUpdates() {
  const queryClient = useQueryClient();
  const query = useQuery({
    ...updatesQuery,
    refetchInterval: (current) =>
      current.state.data?.job?.state === 'running' ? JOB_POLL_MS : false,
  });
  const settings = useSettings(KEYS, 'Update settings saved');
  const [dialog, setDialog] = useState<UpdateDialog>(null);

  const store = (status: UpdateStatus) => {
    queryClient.setQueryData(updatesQuery.queryKey, status);
    void queryClient.invalidateQueries({ queryKey: queryKeys.system() });
  };
  const onError = (error: unknown) => toast(describeError(error).message, 'danger');

  const check = useMutation({
    mutationFn: () => api.updates.check(),
    onSuccess: (status) => {
      store(status);
      toast(status.latest ? `Bemmoly ${status.latest.version} is available` : 'You are up to date');
    },
    onError,
  });

  const apply = useMutation({
    mutationFn: (version: string) => api.updates.apply(version),
    onSuccess: (status) => {
      store(status);
      setDialog(null);
    },
  });

  const rollback = useMutation({
    mutationFn: () => api.updates.rollback(),
    onSuccess: (status) => {
      store(status);
      setDialog(null);
    },
  });

  const setChannel = (channel: UpdateChannel) =>
    settings.save.mutate(
      { 'updates.channel': channel },
      { onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.updates() }) },
    );

  const status = query.data;
  return {
    ...query,
    status,
    busy: status?.job?.state === 'running',
    channel: settings.reads?.['updates.channel'].value ?? status?.channel ?? 'stable',
    checkDaily: settings.reads?.['updates.checkForUpdates'].value ?? true,
    setChannel,
    setCheckDaily: (on: boolean) => settings.save.mutate({ 'updates.checkForUpdates': on }),
    savingSettings: settings.save.isPending,
    check,
    apply,
    rollback,
    /** A restore rollback offers the audit rows it would discard as CSV. */
    auditExportUrl: (since: string) => api.audit.exportUrl({ since }),
    dialog: {
      kind: dialog,
      open: (kind: Exclude<UpdateDialog, null>) => {
        apply.reset();
        rollback.reset();
        setDialog(kind);
      },
      close: () => setDialog(null),
    },
  };
}
