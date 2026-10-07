import { backupKindSchema } from '@bemmoly/shared';
import { z } from 'zod';
import type { SystemDependencies } from '../deps.ts';
import { readSetting } from '../settings.ts';
import { createBackupRepository } from './repository.ts';
import { runBackup } from './run-backup.ts';
import { dueSlot } from './schedule.ts';

export const BACKUP_JOB = 'system.backup';
export const BACKUP_DRILL_JOB = 'system.backup-drill';

/** No payload is the schedule tick; manual and pre-upgrade runs say so. */
export const backupJobPayloadSchema = z
  .object({
    kind: backupKindSchema.default('scheduled'),
    backupId: z.uuid().optional(),
  })
  .default({ kind: 'scheduled' });

export type BackupJobPayload = z.infer<typeof backupJobPayloadSchema>;

/**
 * The system.backup handler. The tick runs every five minutes and starts a backup only
 * when the schedule's latest slot is not covered yet, so changing the schedule in
 * Settings needs no rescheduling and a duplicated tick cannot run twice (the slot is
 * unique on the row).
 */
export async function handleBackupJob(
  deps: SystemDependencies,
  payload: unknown,
): Promise<string | null> {
  const parsed = backupJobPayloadSchema.parse(payload ?? undefined);
  const repository = createBackupRepository(deps.sql);
  if (parsed.backupId) {
    const existing = await repository.get(parsed.backupId);
    if (!existing || existing.status !== 'running') return null;
    return (await runBackup(deps, { kind: existing.kind, existing })).id;
  }
  if (parsed.kind !== 'scheduled') return (await runBackup(deps, { kind: parsed.kind })).id;

  const schedule = await readSetting(deps.settings, 'system.backups.schedule');
  const slot = dueSlot(schedule, await repository.lastScheduledFor(), deps.now?.() ?? new Date());
  if (!slot) return null;
  try {
    return (await runBackup(deps, { kind: 'scheduled', scheduledFor: slot })).id;
  } catch (error) {
    if ((error as { code?: string }).code === '23505') return null;
    throw error;
  }
}
