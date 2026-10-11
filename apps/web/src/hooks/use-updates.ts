import { hasErrorCode, queryKeys } from '@bemmoly/api-client';
import type { RollbackMode } from '@bemmoly/shared';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.ts';
import { describeError } from '../lib/errors.ts';
import { toast } from '../lib/toast.ts';
import { MAINTENANCE_POLL_MS, useSystemMaintenance } from './use-system-maintenance.ts';
import { UPDATE_POLL_MS, useUpdateFollow } from './use-update-follow.ts';
import { commandFrom } from './use-updates-copy.ts';

export const updatesQuery = queryOptions({
  queryKey: queryKeys.updates(),
  queryFn: () => api.updates.overview(),
});

export type UpdateDialog = 'update' | 'rollback' | null;

/**
 * Settings › Updates: the running version (the channel and daily check are in
 * useUpdateSettings), the
 * available release, and the rollback plan. Nothing runs until the admin
 * confirms in a dialog; while the updater works the overview is polled.
 */
export function useUpdates() {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<UpdateDialog>(null);
  /** The plan changed between showing the dialog and confirming it. */
  const [planChanged, setPlanChanged] = useState(false);
  /** The Update dialog shows the running update rather than the confirmation. */
  const [watching, setWatching] = useState(false);
  /** The run whose dialog the admin closed; it does not open again by itself. */
  const dismissed = useRef<string | null>(null);
  /** Read by the polling interval, which is set up before the follow state exists. */
  const followingRef = useRef(false);

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.updates() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.system() }),
    ]);

  const apply = useMutation({
    mutationFn: (version: string) => api.updates.apply(version),
    onSuccess: async (accepted) => {
      setWatching(true);
      follow.follow(accepted.target);
      followingRef.current = true;
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

  /** "Check for updates": fetch the release list now; the answer replaces the overview. */
  const check = useMutation({
    mutationFn: () => api.updates.check(),
    onSuccess: async (overview) => {
      queryClient.setQueryData(queryKeys.updates(), overview);
      if (overview.checks.error)
        toast(`Could not fetch the release list: ${overview.checks.error}`, 'danger');
      else if (overview.available) toast(`${overview.available.version} is available`);
      else toast('You are on the latest release');
      await queryClient.invalidateQueries({ queryKey: queryKeys.system() });
    },
    onError: (error) => toast(describeError(error).message, 'danger'),
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
    // While an update runs the app restarts: keep asking every second, without backing off.
    retry: (count) => !followingRef.current && count < 3,
    // A tab in the background keeps following too, so it reloads onto the new version.
    refetchIntervalInBackground: true,
    refetchInterval: (current) => {
      const updater = current.state.data?.updater;
      if (followingRef.current || updater?.progress?.outcome === 'running') return UPDATE_POLL_MS;
      return updater?.state === 'running' ? MAINTENANCE_POLL_MS : maintenance.poll;
    },
  });

  const overview = query.data;
  const follow = useUpdateFollow(overview, query.isError);
  useEffect(() => {
    followingRef.current = follow.following;
  }, [follow.following]);
  const progress = overview?.updater.progress ?? null;
  const runKey = progress?.outcome === 'running' ? (progress.startedAt ?? 'running') : null;

  // Every admin on the page sees a running update, and the page that reloaded onto the new
  // version shows how the update ended.
  const reloadShown = useRef(false);
  const currentVersion = overview?.current.version;
  useEffect(() => {
    const reloaded =
      !reloadShown.current && Boolean(follow.reloadedFor) && currentVersion === follow.reloadedFor;
    if (dialog || !(reloaded || (runKey && dismissed.current !== runKey))) return;
    if (reloaded) reloadShown.current = true;
    setWatching(true);
    setDialog('update');
  }, [dialog, runKey, follow.reloadedFor, currentVersion]);
  return {
    ...query,
    overview,
    maintenance,
    running: overview?.updater.state === 'running',
    apply,
    /** Set when the install has no updater: the command to run on the server instead. */
    cliCommand: commandFrom(apply.error),
    applyError: commandFrom(apply.error) ? null : apply.error,
    rollback,
    check,
    upload,
    planChanged,
    /** A restore rollback offers the audit rows it would discard as CSV. */
    auditExportUrl: (since: string) => api.audit.exportUrl({ since }),
    progress,
    restarting: follow.restarting,
    dialog: {
      kind: dialog,
      /** The Update dialog follows the running update instead of asking to start one. */
      watching,
      open: (kind: Exclude<UpdateDialog, null>) => {
        apply.reset();
        rollback.reset();
        setPlanChanged(false);
        setWatching(false);
        setDialog(kind);
      },
      /** "Show progress": reopens the dialog on the running update. */
      watch: () => {
        setWatching(true);
        setDialog('update');
      },
      close: () => {
        dismissed.current = runKey;
        setDialog(null);
      },
    },
  };
}
