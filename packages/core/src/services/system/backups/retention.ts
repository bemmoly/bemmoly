import type { BackupKind, BackupRetentionSettings, BackupStatus } from '@bemmoly/shared';
import { isoWeekKey, localParts } from '../utils/zoned-time.ts';

export interface RetentionCandidate {
  id: string;
  kind: BackupKind;
  status: BackupStatus;
  createdAt: Date;
  /** The previous set in the attachment chain; a kept backup keeps its whole chain. */
  baseBackupId: string | null;
}

export interface RetentionDecision {
  keep: string[];
  prune: string[];
  /** Why each kept backup is kept, for logs and tests. */
  reasons: Record<string, string[]>;
}

const DAY_MS = 86_400_000;
const FAILED_ROW_DAYS = 30;

type Level = 'hourly' | 'daily' | 'weekly' | 'monthly';

function bucket(level: Level, date: Date, timeZone: string): string {
  const local = localParts(date, timeZone);
  const day = `${local.year}-${local.month}-${local.day}`;
  switch (level) {
    case 'hourly':
      return `${day} ${local.hour}`;
    case 'daily':
      return day;
    case 'weekly':
      return isoWeekKey(local);
    case 'monthly':
      return `${local.year}-${local.month}`;
  }
}

/**
 * Grandfather-father-son: per level, the newest backup in each of the last N
 * buckets. Pre-upgrade backups follow their own age limit. The newest good backup is
 * always kept, and a kept incremental keeps every set its attachments depend on.
 */
export function selectRetained(
  backups: readonly RetentionCandidate[],
  policy: BackupRetentionSettings,
  timeZone: string,
  now: Date,
): RetentionDecision {
  const reasons: Record<string, string[]> = {};
  const keep = (id: string, reason: string) => {
    (reasons[id] ??= []).push(reason);
  };
  const succeeded = backups
    .filter((backup) => backup.status === 'succeeded')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const regular = succeeded.filter((backup) => backup.kind !== 'pre_upgrade');

  const newest = succeeded[0];
  if (newest) keep(newest.id, 'newest');

  for (const level of ['hourly', 'daily', 'weekly', 'monthly'] as const) {
    const limit = policy[level];
    const seen = new Set<string>();
    for (const backup of regular) {
      if (seen.size >= limit) break;
      const key = bucket(level, backup.createdAt, timeZone);
      if (seen.has(key)) continue;
      seen.add(key);
      keep(backup.id, `${level} ${key}`);
    }
  }

  for (const backup of succeeded) {
    if (backup.kind !== 'pre_upgrade') continue;
    const ageDays = (now.getTime() - backup.createdAt.getTime()) / DAY_MS;
    if (ageDays < policy.preUpgradeDays) keep(backup.id, 'pre-upgrade window');
  }

  const byId = new Map(backups.map((backup) => [backup.id, backup]));
  for (const id of Object.keys(reasons)) {
    let parent = byId.get(id)?.baseBackupId ?? null;
    while (parent) {
      const base = byId.get(parent);
      if (!base || base.status !== 'succeeded') break;
      keep(base.id, `chain of ${id}`);
      parent = base.baseBackupId;
    }
  }

  const prune = backups
    .filter((backup) => {
      if (backup.id in reasons) return false;
      if (backup.status === 'succeeded') return true;
      const ageDays = (now.getTime() - backup.createdAt.getTime()) / DAY_MS;
      return backup.status === 'failed' && ageDays > FAILED_ROW_DAYS;
    })
    .map((backup) => backup.id);

  return { keep: Object.keys(reasons), prune, reasons };
}
