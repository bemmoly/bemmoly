import type { RollbackPlan } from '@bemmoly/shared';
import { createBackupRepository, type BackupRecord } from '../backups/repository.ts';
import type { ChangesetTraits, SystemDependencies } from '../deps.ts';
import { readSetting } from '../settings.ts';
import { decideRollbackMode, describeRollback } from './rollback-mode.ts';
import { readUpdaterState } from './state.ts';

const DAY_MS = 86_400_000;

/**
 * Changesets applied after the version being rolled back to was tagged (the updater
 * tags the outgoing version before every update), or null when that cannot be known.
 */
async function changesetsSinceTag(
  deps: SystemDependencies,
  tag: string,
): Promise<ChangesetTraits[] | null> {
  if (!deps.changelog) return null;
  try {
    return await deps.changelog.changesSince(tag);
  } catch (error) {
    deps.logger.warn({ err: error, tag }, 'could not read the changelog for the rollback plan');
    return null;
  }
}

async function preUpgradeBackup(
  deps: SystemDependencies,
  id: string | null,
  since: Date,
): Promise<BackupRecord | null> {
  const repository = createBackupRepository(deps.sql);
  const byId = id ? await repository.get(id) : null;
  if (byId?.status === 'succeeded') return byId;
  const latest = await repository.latest({ status: 'succeeded', kind: 'pre_upgrade' });
  return latest && latest.createdAt.getTime() >= since.getTime() - DAY_MS ? latest : null;
}

/**
 * What "Roll back" would do right now (§18): the mode the changelog dictates and, for a
 * restore, how much the audit log says will be discarded. Null when there is nothing to
 * roll back to or the window has passed.
 */
export async function computeRollbackPlan(
  deps: SystemDependencies,
  options: { preferRestore: boolean },
): Promise<RollbackPlan | null> {
  const updater = await readUpdaterState(deps.config.dataDir);
  if (!updater?.previous || !updater.current || !updater.updatedAt) return null;
  const retention = await readSetting(deps.settings, 'system.backups.retention');
  const schedule = await readSetting(deps.settings, 'system.backups.schedule');
  const updatedAt = new Date(updater.updatedAt);
  const expiresAt = new Date(updatedAt.getTime() + retention.preUpgradeDays * DAY_MS);
  const now = deps.now?.() ?? new Date();
  if (now > expiresAt) return null;

  const backup = await preUpgradeBackup(deps, updater.preUpgradeBackupId, updatedAt);
  const decision = decideRollbackMode({
    fromVersion: updater.current,
    toVersion: updater.previous,
    changesetsSinceTag: await changesetsSinceTag(deps, updater.previous),
    preferRestore: options.preferRestore,
    hasPreUpgradeBackup: backup !== null,
  });
  let discard: RollbackPlan['discard'] = null;
  if (decision.mode === 'restore' && backup && deps.audit) {
    const counted = await deps.audit.countSince(backup.createdAt).catch((error: unknown) => {
      deps.logger.info({ err: error }, 'no audit rows to count for the rollback summary');
      return null;
    });
    if (counted) discard = { ...counted, since: backup.createdAt.toISOString() };
  }
  return {
    fromVersion: updater.current,
    toVersion: updater.previous,
    mode: decision.mode,
    reason: decision.reason,
    summary: describeRollback(
      decision,
      updater.previous,
      discard ? { ...discard, since: new Date(discard.since) } : null,
      schedule.timezone,
    ),
    schemaChangesets: decision.schemaChangesets,
    discard,
    backupId: backup?.id ?? null,
    expiresAt: expiresAt.toISOString(),
  };
}
