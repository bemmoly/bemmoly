import { ValidationError } from '@bemmoly/shared';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import type { SystemDependencies } from '../deps.ts';
import { enterMaintenance, exitMaintenance } from '../maintenance/state.ts';
import { assertNoUpdaterOperation } from '../maintenance/updater-lock.ts';
import { resolveSetSource, readSetManifest } from './fetch-set.ts';
import { syncBackupIndex } from './index-sync.ts';
import {
  databaseNameOf,
  dropDatabase,
  makeReadOnly,
  stampOf,
  swapDatabases,
  urlForDatabase,
  withAdmin,
} from './restore-database.ts';
import { restoreAttachments, restoreIntoNewDatabase } from './restore-files.ts';

export interface RestoreResult {
  setName: string;
  backupVersion: string;
  database: string;
  /** The replaced database, kept for the retention window. */
  rolledBackDatabase: string;
  rowCounts: Record<string, number>;
  attachmentsRestored: number;
  pendingChangesets: number | null;
}

export interface MountResult {
  setName: string;
  database: string;
  /** Connection URL without the password. */
  url: string;
}

const withoutPassword = (url: string) => {
  const parsed = new URL(url);
  parsed.password = '';
  return parsed.toString();
};

/** A backup from an older version is brought up to this one's schema. */
async function runPendingChangesets(deps: SystemDependencies): Promise<number | null> {
  return deps.changelog ? deps.changelog.update() : null;
}

/**
 * Replaces the live database with a backup (§18 Restore): maintenance mode, restore
 * into a fresh database, verify row counts, restore attachments, swap by rename, run
 * pending changesets when the backup is older, leave maintenance. The replaced database
 * is kept as <db>_rolledback_<time>.
 *
 * Refused while the updater holds its lock, unless the updater itself asks (`asUpdater`):
 * a rollback restores the pre-upgrade backup from inside that lock.
 */
export async function restoreBackup(
  deps: SystemDependencies,
  ref: string,
  options: { asUpdater?: boolean } = {},
): Promise<RestoreResult> {
  if (!options.asUpdater) await assertNoUpdaterOperation(deps.config.dataDir);
  const source = await resolveSetSource(deps, ref);
  const manifest = await readSetManifest(source);
  const now = deps.now?.() ?? new Date();
  const live = databaseNameOf(deps.config.databaseUrl);
  const stamp = stampOf(now);
  const replacement = `${live}_restore_${stamp}`;
  const rolledBack = `${live}_rolledback_${stamp}`;
  const staging = path.join(deps.config.backupDir, '.staging', `restore-${stamp}`);
  await enterMaintenance(deps.config.dataDir, {
    reason: 'restore',
    message: `Restoring the backup from ${manifest.createdAt.slice(0, 16).replace('T', ' ')} UTC (version ${manifest.appVersion}).`,
    step: 'Restoring the database',
    startedAt: now,
  });
  try {
    const rowCounts = await restoreIntoNewDatabase(deps, source, manifest, replacement, staging);
    await enterMaintenance(deps.config.dataDir, {
      reason: 'restore',
      message: `Restoring the backup from ${manifest.createdAt.slice(0, 16).replace('T', ' ')} UTC.`,
      step: 'Restoring attachments',
      startedAt: now,
    });
    const attachmentsRestored = await restoreAttachments(deps, source, manifest, staging);
    await withAdmin(deps.config.databaseUrl, (admin) =>
      swapDatabases(admin, { live, replacement, rolledBack }),
    );
    deps.logger.warn({ set: manifest.setName, rolledBack }, 'database replaced by a backup');
    const pendingChangesets = await runPendingChangesets(deps);
    await syncBackupIndex(deps, { interruptedBefore: now }).catch((error: unknown) =>
      deps.logger.error({ err: error }, 'could not re-index backups after the restore'),
    );
    return {
      setName: manifest.setName,
      backupVersion: manifest.appVersion,
      database: live,
      rolledBackDatabase: rolledBack,
      rowCounts,
      attachmentsRestored,
      pendingChangesets,
    };
  } finally {
    await rm(staging, { recursive: true, force: true });
    await exitMaintenance(deps.config.dataDir);
  }
}

/** `bemmoly restore --mount`: the backup as a second, read-only database. */
export async function mountBackup(deps: SystemDependencies, ref: string): Promise<MountResult> {
  const source = await resolveSetSource(deps, ref);
  const manifest = await readSetManifest(source);
  const stamp = stampOf(deps.now?.() ?? new Date());
  const name = `${databaseNameOf(deps.config.databaseUrl)}_mount_${stamp}`;
  const staging = path.join(deps.config.backupDir, '.staging', `mount-${stamp}`);
  try {
    await restoreIntoNewDatabase(deps, source, manifest, name, staging);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
  await withAdmin(deps.config.databaseUrl, (admin) => makeReadOnly(admin, name));
  return {
    setName: manifest.setName,
    database: name,
    url: withoutPassword(urlForDatabase(deps.config.databaseUrl, name)),
  };
}

export async function unmountBackup(deps: SystemDependencies, name: string): Promise<void> {
  const live = databaseNameOf(deps.config.databaseUrl);
  if (!new RegExp(`^${live}_mount_\\d{14}$`).test(name)) {
    throw new ValidationError(`${name} is not a mounted backup (expected ${live}_mount_<time>)`);
  }
  await withAdmin(deps.config.databaseUrl, (admin) => dropDatabase(admin, name));
}
