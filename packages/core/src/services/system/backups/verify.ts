import { NotFoundError, type BackupVerificationState } from '@bemmoly/shared';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { systemActorId, type SystemDependencies } from '../deps.ts';
import { publishSystemEvent } from '../events.ts';
import { readSetting } from '../settings.ts';
import { diskSpace, formatBytes } from '../utils/disk.ts';
import { withBackupAudit, type BackupAudit } from './audit.ts';
import { fetchPart, readSetManifest, resolveSetSource } from './fetch-set.ts';
import { createBackupRepository, type BackupRecord } from './repository.ts';
import { databaseNameOf, stampOf } from './restore-database.ts';
import { restoreIntoNewDatabase } from './restore-files.ts';
import { dropDatabase, withAdmin } from './restore-database.ts';

const WEEK_MS = 7 * 86_400_000;
const SCHEDULED: BackupAudit = { actor: { kind: 'system', id: systemActorId } };

export interface VerifyResult {
  backupId: string;
  depth: 'list' | 'restore';
  ok: boolean;
  /** Present when the drill was skipped because the disk is too full. */
  skipped?: string;
  message: string;
}

/**
 * Checks a backup: `list` re-reads every checksum and runs pg_restore --list;
 * `restore` (the "Restore drill") also restores into a temporary database and
 * compares row counts with the backup's own snapshot, then drops it. With
 * `audit`, the verdict and its audit row are written in one transaction.
 */
export async function verifyBackup(
  deps: SystemDependencies,
  backupId: string,
  depth: 'list' | 'restore',
  audit?: BackupAudit,
): Promise<VerifyResult> {
  const repository = createBackupRepository(deps.sql);
  const record = await repository.get(backupId);
  if (!record || record.status !== 'succeeded')
    throw new NotFoundError(`No completed backup ${backupId}`);
  const now = deps.now?.() ?? new Date();
  const stamp = stampOf(now);
  const settle = async (state: BackupVerificationState, message: string, drilled: boolean) => {
    const write = (target = repository) =>
      target.setVerification(record.id, state, message, deps.now?.() ?? new Date(), drilled);
    if (!audit) return write();
    await withBackupAudit(deps, audit, write, () => ({
      action: 'backup.verified',
      backupId: record.id,
      before: { state: record.verificationState },
      after: { depth, state, message },
    }));
  };
  const staging = path.join(deps.config.backupDir, '.staging', `verify-${stamp}`);
  try {
    const source = await resolveSetSource(deps, record.setName);
    const manifest = await readSetManifest(source);
    if (depth === 'restore') {
      const needed = manifest.database.plainSizeBytes * 4;
      const { freeBytes } = await diskSpace(deps.config.backupDir);
      if (freeBytes < needed) {
        const skipped = `Restore drill skipped: ${formatBytes(freeBytes)} free, about ${formatBytes(needed)} needed`;
        deps.logger.warn({ backupId }, skipped);
        return { backupId, depth, ok: true, skipped, message: skipped };
      }
      const drill = `${databaseNameOf(deps.config.databaseUrl)}_drill_${stamp}`;
      const counts = await restoreIntoNewDatabase(deps, source, manifest, drill, staging);
      await withAdmin(deps.config.databaseUrl, (admin) => dropDatabase(admin, drill));
      const message = `Restored into a temporary database; row counts match (${
        Object.entries(counts)
          .map(([table, count]) => `${table} ${count}`)
          .join(', ') || 'no key tables yet'
      })`;
      await settle('restored', message, true);
      deps.onGoodBackup?.(record.completedAt ?? record.createdAt);
      return { backupId, depth, ok: true, message };
    }
    await mkdir(staging, { recursive: true });
    const dumpFile = path.join(staging, 'database.dump');
    await fetchPart({
      source,
      part: manifest.database,
      passphrase: deps.config.backupPassphrase,
      target: dumpFile,
    });
    await deps.pgTools.list(dumpFile);
    if (manifest.attachments.archive) {
      await fetchPart({
        source,
        part: manifest.attachments.archive,
        passphrase: deps.config.backupPassphrase,
      });
    }
    const message = 'Checksums match and pg_restore can read the dump';
    await settle('listed', message, false);
    return { backupId, depth, ok: true, message };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await settle('failed', message, depth === 'restore');
    await publishSystemEvent(
      deps,
      'backup.verification_failed',
      { backupId: record.id, setName: record.setName, depth, message },
      record.id,
    );
    return { backupId, depth, ok: false, message };
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

/** The weekly drill: the newest good backup, when it has not been drilled for a week. */
export async function runScheduledDrill(deps: SystemDependencies): Promise<VerifyResult | null> {
  const verification = await readSetting(deps.settings, 'system.backups.verification');
  if (verification.testRestore === 'off') return null;
  const repository = createBackupRepository(deps.sql);
  const latest: BackupRecord | null = await repository.latest({ status: 'succeeded' });
  if (!latest) return null;
  const lastDrill = (await repository.all()).reduce<number>(
    (newest, record) => Math.max(newest, record.drilledAt?.getTime() ?? 0),
    0,
  );
  const now = deps.now?.() ?? new Date();
  if (now.getTime() - lastDrill < WEEK_MS) return null;
  return verifyBackup(deps, latest.id, 'restore', SCHEDULED);
}
