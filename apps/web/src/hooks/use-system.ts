import { queryKeys } from '@bemmoly/api-client';
import { formatBytes, formatRelative } from '@bemmoly/core-web';
import type { Backup, HealthCheck } from '@bemmoly/shared';
import { queryOptions, useQuery } from '@tanstack/react-query';
import type { CircleTone } from '../components/system/status-circle.tsx';
import { api } from '../lib/api.ts';

/** The page refreshes on its own while open; health is cheap to read. */
const REFRESH_MS = 30_000;
/** The tech design's safety net fires when the scheduler has not run in 36 hours. */
const STALE_BACKUP_MS = 36 * 3_600_000;

export const systemQuery = queryOptions({
  queryKey: queryKeys.system(),
  queryFn: () => api.system.status(),
});

export const healthTone = (status: HealthCheck['status']): CircleTone =>
  status === 'ok' ? 'ok' : status === 'warning' ? 'caution' : 'danger';

/** "7h ago · verified · 412 MB", and whether it needs attention. */
export function lastBackupLine(
  backup: Backup | null,
  now: number,
): { text: string; tone: CircleTone } {
  if (!backup) return { text: 'No backup yet', tone: 'caution' };
  const when = backup.finishedAt ?? backup.startedAt;
  const parts = [formatRelative(when), backup.verification.replace('_', ' ')];
  if (backup.sizeBytes !== null) parts.push(formatBytes(backup.sizeBytes));
  if (backup.status === 'failed') return { text: `failed ${parts[0]}`, tone: 'danger' };
  const stale = now - new Date(when).getTime() > STALE_BACKUP_MS;
  return { text: parts.join(' · '), tone: stale ? 'caution' : 'ok' };
}

/** Settings › System status: health probes, job queue, last backup and version. */
export function useSystem() {
  const query = useQuery({ ...systemQuery, refetchInterval: REFRESH_MS });
  const status = query.data;
  return {
    ...query,
    status,
    // Age is measured against when the status was read, which keeps render pure.
    lastBackup: status ? lastBackupLine(status.lastBackup, query.dataUpdatedAt) : null,
  };
}
