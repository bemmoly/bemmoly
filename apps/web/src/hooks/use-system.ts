import { queryKeys } from '@bemmoly/api-client';
import { formatBytes, formatRelative } from '@bemmoly/core-web';
import type { Backup, SystemCheck, SystemHealthResponse } from '@bemmoly/shared';
import { useQuery } from '@tanstack/react-query';
import type { CircleTone } from '../components/system/status-circle.tsx';
import { api } from '../lib/api.ts';
import { MAINTENANCE_POLL_MS, maintenanceOf, systemHealthQuery } from './use-system-maintenance.ts';

/** The page refreshes on its own while open; health is cheap to read. */
const REFRESH_MS = 30_000;
/** The tech design's safety net fires when the scheduler has not run in 36 hours. */
const STALE_BACKUP_MS = 36 * 3_600_000;

export const checkTone = (status: SystemCheck['status']): CircleTone =>
  status === 'ok' ? 'ok' : status === 'warn' ? 'caution' : 'danger';

export const VERIFICATION_WORDS: Record<Backup['verification']['state'], string> = {
  restored: 'verified',
  listed: 'archive checked',
  pending: 'not verified yet',
  failed: 'verification failed',
};

/** "7h ago · verified · 412 MB", and whether it needs attention. */
export function lastBackupLine(
  backup: Backup | undefined,
  now: number,
): { text: string; tone: CircleTone } {
  if (!backup) return { text: 'No backup yet', tone: 'caution' };
  const when = backup.completedAt ?? backup.createdAt;
  if (backup.status === 'failed') return { text: `failed ${formatRelative(when)}`, tone: 'danger' };
  if (backup.status === 'running') return { text: 'running now', tone: 'ok' };
  const parts = [
    formatRelative(when),
    VERIFICATION_WORDS[backup.verification.state],
    formatBytes(backup.sizeBytes),
  ];
  const stale = now - new Date(when).getTime() > STALE_BACKUP_MS;
  const failedCheck = backup.verification.state === 'failed';
  return { text: parts.join(' · '), tone: stale || failedCheck ? 'caution' : 'ok' };
}

/** "3 days 4 hours", "5 hours 12 minutes", "40 minutes". */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const unit = (value: number, name: string) => `${value} ${name}${value === 1 ? '' : 's'}`;
  if (days) return [unit(days, 'day'), hours ? unit(hours, 'hour') : ''].join(' ').trim();
  if (hours) return [unit(hours, 'hour'), minutes ? unit(minutes, 'minute') : ''].join(' ').trim();
  return unit(minutes, 'minute');
}

export const ROLE_WORDS: Record<SystemHealthResponse['role'], string> = {
  all: 'API and worker in one process',
  api: 'API only',
  worker: 'Worker only',
};

/** Settings › System status: the server's checks, version, role, uptime, maintenance, last backup. */
export function useSystem() {
  const health = useQuery({
    ...systemHealthQuery,
    refetchInterval: (query) =>
      query.state.data?.maintenance.active ? MAINTENANCE_POLL_MS : REFRESH_MS,
  });
  const latest = useQuery({
    queryKey: queryKeys.backups.list({ limit: 1 }),
    queryFn: () => api.backups.list({ limit: 1 }),
  });
  const status = health.data;
  return {
    ...health,
    status,
    maintenance: maintenanceOf(status?.maintenance, []),
    // Age is measured against when the list was read, which keeps render pure.
    lastBackup: latest.isSuccess
      ? lastBackupLine(latest.data.items[0], latest.dataUpdatedAt)
      : null,
  };
}
