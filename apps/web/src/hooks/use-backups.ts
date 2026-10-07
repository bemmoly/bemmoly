import { queryKeys } from '@bemmoly/api-client';
import { formatRelative } from '@bemmoly/core-web';
import type { Backup, BackupsPage } from '@bemmoly/shared';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api.ts';
import { describeError } from '../lib/errors.ts';
import { toast } from '../lib/toast.ts';

export const backupsListKey = [...queryKeys.backups(), 'list'] as const;

export interface StatusPart {
  text: string;
  /** Shown in the caution colour: "one disk", a failed verification. */
  caution?: boolean;
}

/** "02:00 UTC" in the schedule's own timezone, as the admin chose it. */
export function clockIn(iso: string, timeZone: string): string {
  const time = new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  });
  return `${time} ${timeZone}`;
}

/** "Last good backup 7h ago · verified · next run 02:00 UTC · one disk". */
export function statusLine(
  summary: BackupsPage['summary'] | undefined,
  backups: readonly Backup[],
  timeZone: string,
): StatusPart[] {
  if (!summary) return [];
  const parts: StatusPart[] = [];
  const lastGood = backups.find((backup) => backup.status === 'succeeded');
  if (summary.lastGoodAt) {
    parts.push({ text: `Last good backup ${formatRelative(summary.lastGoodAt)}` });
    if (lastGood) {
      const verification = lastGood.verification.replace('_', ' ');
      parts.push({ text: verification, caution: lastGood.verification === 'failed' });
    }
  } else {
    parts.push({ text: 'No good backup yet', caution: true });
  }
  if (summary.nextRunAt) parts.push({ text: `next run ${clockIn(summary.nextRunAt, timeZone)}` });
  if (summary.oneDisk) parts.push({ text: 'one disk', caution: true });
  return parts;
}

/**
 * The backups list with its summary, "Back up now", the restore drill, and a
 * restore confirmed by typing the backup id back.
 */
export function useBackups() {
  const queryClient = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: backupsListKey,
    queryFn: ({ pageParam }) => api.backups.list(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [typed, setTyped] = useState('');

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.backups() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.system() }),
    ]);
  const onError = (error: unknown) => toast(describeError(error).message, 'danger');

  const run = useMutation({
    mutationFn: () => api.backups.run(),
    onSuccess: async (backup) => {
      await refresh();
      toast(backup.status === 'succeeded' ? 'Backup finished' : 'Backup started');
    },
    onError,
  });

  const verify = useMutation({
    mutationFn: (id: string) => api.backups.verify(id),
    onSuccess: async (backup) => {
      await refresh();
      if (backup.verification === 'verified') toast(`Restore drill passed for ${backup.id}`);
      else if (backup.verification === 'failed')
        toast(`Restore drill failed for ${backup.id}`, 'danger');
      else toast(`Restore drill started for ${backup.id}`, 'info');
    },
    onError,
  });

  const restore = useMutation({
    mutationFn: (id: string) => api.backups.restore(id),
    onSuccess: () => {
      setRestoreId(null);
      toast('Restore started. Bemmoly is in maintenance mode until it finishes.', 'info');
    },
  });

  const pages = query.data?.pages ?? [];
  const backups = pages.flatMap((page) => page.items);
  const restoreTarget = backups.find((backup) => backup.id === restoreId) ?? null;

  return {
    ...query,
    backups,
    summary: pages[0]?.summary,
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
