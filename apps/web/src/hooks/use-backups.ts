import { queryKeys } from '@bemmoly/api-client';
import { formatRelative } from '@bemmoly/core-web';
import type { Backup, BackupScheduleSettings } from '@bemmoly/shared';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api.ts';
import { describeError } from '../lib/errors.ts';
import { toast } from '../lib/toast.ts';
import { useSystemMaintenance } from './use-system-maintenance.ts';
import { VERIFICATION_WORDS } from './use-system.ts';

const PAGE = 25;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface StatusPart {
  text: string;
  /** Shown in the caution colour: "one disk", a failed verification. */
  caution?: boolean;
}

/** When the schedule runs next, in the schedule's own words and timezone. */
export function nextRunLabel(schedule: BackupScheduleSettings): string {
  const at = `${schedule.time} ${schedule.timezone}`;
  if (schedule.frequency === 'hourly') return 'runs every hour';
  if (schedule.frequency === '6h') return `runs every 6 hours from ${at}`;
  if (schedule.frequency === 'weekly') return `next run ${WEEKDAYS[schedule.weekday]} ${at}`;
  return `next run ${at}`;
}

/** "Last good backup 7h ago · verified · next run 02:00 UTC · one disk". */
export function statusLine(
  backups: readonly Backup[],
  schedule: BackupScheduleSettings | undefined,
  offBox: boolean,
): StatusPart[] {
  const parts: StatusPart[] = [];
  const lastGood = backups.find((backup) => backup.status === 'succeeded');
  if (lastGood) {
    const state = lastGood.verification.state;
    parts.push({
      text: `Last good backup ${formatRelative(lastGood.completedAt ?? lastGood.createdAt)}`,
    });
    parts.push({ text: VERIFICATION_WORDS[state], caution: state === 'failed' });
  } else {
    parts.push({ text: 'No good backup yet', caution: true });
  }
  if (schedule) parts.push({ text: nextRunLabel(schedule) });
  if (!offBox) parts.push({ text: 'one disk', caution: true });
  return parts;
}

/**
 * The backups list, "Back up now", the archive check and restore drill, and a
 * restore the admin confirms by typing the backup id back.
 */
export function useBackups() {
  const queryClient = useQueryClient();
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [typed, setTyped] = useState('');

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.backups.all() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.system() }),
    ]);
  const onError = (error: unknown) => {
    toast(describeError(error).message, 'danger');
    void refresh();
  };

  const run = useMutation({
    mutationFn: () => api.backups.run(),
    onSuccess: async (backup) => {
      await refresh();
      toast(backup.status === 'succeeded' ? 'Backup finished' : 'Backup started');
    },
    onError,
  });

  const verify = useMutation({
    mutationFn: ({ id, depth }: { id: string; depth: 'list' | 'restore' }) =>
      api.backups.verify(id, depth),
    onSuccess: async (_, { depth }) => {
      await refresh();
      toast(depth === 'list' ? 'Archive checked' : 'Restore drill started', 'info');
    },
    onError,
  });

  const restore = useMutation({
    mutationFn: (id: string) => api.backups.restore(id),
    onSuccess: async () => {
      setRestoreId(null);
      await refresh();
    },
    onError: () => void refresh(),
  });

  const maintenance = useSystemMaintenance([run.error, verify.error, restore.error]);
  const query = useInfiniteQuery({
    queryKey: queryKeys.backups.list({ limit: PAGE }),
    queryFn: ({ pageParam }) =>
      api.backups.list({ limit: PAGE, ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchInterval: maintenance.poll,
  });

  const backups = query.data?.pages.flatMap((page) => page.items) ?? [];
  const restoreTarget = backups.find((backup) => backup.id === restoreId) ?? null;

  return {
    ...query,
    backups,
    maintenance,
    run,
    verify,
    restore,
    restoreDialog: {
      target: restoreTarget,
      typed,
      setTyped,
      canRestore: restoreTarget !== null && typed.trim() === restoreTarget.id,
      open: (id: string) => {
        setTyped('');
        restore.reset();
        setRestoreId(id);
      },
      close: () => setRestoreId(null),
    },
    downloadUrl: (id: string) => api.backups.downloadUrl(id),
  };
}
