import type { SystemDependencies } from '../deps.ts';
import { readSetting } from '../settings.ts';
import { resolveDestinations } from './destinations/index.ts';
import { dropExpiredDatabases } from './restore-database.ts';
import { createBackupRepository } from './repository.ts';
import { selectRetained, type RetentionDecision } from './retention.ts';

/**
 * Applies GFS retention: deletes the sets of pruned backups from every destination,
 * marks their rows, and drops replaced databases older than the pre-upgrade window.
 */
export async function pruneBackups(deps: SystemDependencies): Promise<RetentionDecision> {
  const repository = createBackupRepository(deps.sql);
  const [policy, schedule] = await Promise.all([
    readSetting(deps.settings, 'system.backups.retention'),
    readSetting(deps.settings, 'system.backups.schedule'),
  ]);
  const now = deps.now?.() ?? new Date();
  const records = await repository.all();
  const decision = selectRetained(records, policy, schedule.timezone, now);
  const pruned = records.filter((record) => decision.prune.includes(record.id));
  const destinations = await resolveDestinations(deps);
  for (const record of pruned) {
    if (record.status !== 'succeeded') continue;
    for (const destination of destinations) {
      await destination.remove(record.setName);
    }
    deps.logger.info({ backupId: record.id, set: record.setName }, 'backup pruned by retention');
  }
  await repository.markPruned(decision.prune);
  await dropExpiredDatabases(deps, policy.preUpgradeDays, now);
  return decision;
}
