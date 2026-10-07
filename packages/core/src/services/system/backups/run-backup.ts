import type { BackupKind } from '@bemmoly/shared';
import { createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import type { SystemDependencies } from '../deps.ts';
import { publishSystemEvent } from '../events.ts';
import { readSetting } from '../settings.ts';
import { diskSpace, formatBytes, requiredBackupSpace } from '../utils/disk.ts';
import { createDigestStream } from '../utils/hashing.ts';
import {
  ATTACHMENTS_ARCHIVE,
  ATTACHMENTS_INDEX,
  attachmentsDir,
  planAttachments,
  scanAttachments,
  serializeIndex,
} from './attachments.ts';
import { resolveDestinations } from './destinations/index.ts';
import { dumpDatabase } from './dump.ts';
import { ENCRYPTION_ALGORITHM } from './encryption.ts';
import { buildManifest, setNameFor } from './manifest.ts';
import { loadPreviousBackup } from './previous.ts';
import { pruneBackups } from './prune.ts';
import { createBackupRepository, type BackupRecord } from './repository.ts';
import { DATABASE_PART, storeSet, type StagedPart, type StoredVariant } from './store-set.ts';

export interface RunBackupRequest {
  kind: BackupKind;
  /** The schedule slot a scheduled run covers. */
  scheduledFor?: Date;
  /** The person who pressed "Back up now". */
  createdBy?: string;
  /** Use a row created earlier (POST /admin/backups creates it before queueing). */
  existing?: BackupRecord;
}

export class BackupRefusedError extends Error {
  override readonly name = 'BackupRefusedError';
}

async function stageAttachments(
  deps: SystemDependencies,
  staging: string,
  files: readonly string[],
): Promise<StagedPart | null> {
  if (files.length === 0) return null;
  const file = path.join(staging, ATTACHMENTS_ARCHIVE);
  const digest = createDigestStream();
  const out = createWriteStream(file, { mode: 0o640 });
  const written = new Promise<void>((resolve, reject) => {
    out.once('finish', resolve);
    out.once('error', reject);
  });
  digest.pipe(out);
  await deps.tar.create(attachmentsDir(deps.config.dataDir), files, digest);
  await written;
  return { path: file, name: ATTACHMENTS_ARCHIVE, digest: digest.digest() };
}

/** Refuses to start when less than twice the previous backup's size is free (§18). */
async function guardDiskSpace(
  deps: SystemDependencies,
  previousSize: number | null,
): Promise<void> {
  const required = requiredBackupSpace(previousSize);
  const { freeBytes } = await diskSpace(deps.config.backupDir);
  if (freeBytes < required) {
    throw new BackupRefusedError(
      `Only ${formatBytes(freeBytes)} free in ${deps.config.backupDir}; a backup needs ${formatBytes(required)} (twice the previous one). Free space or add an S3 destination.`,
    );
  }
}

async function createRow(deps: SystemDependencies, request: RunBackupRequest, now: Date) {
  if (request.existing) return request.existing;
  const repository = createBackupRepository(deps.sql);
  const id = crypto.randomUUID();
  const tag = await deps.changelog?.tags?.latest().catch(() => null);
  return repository.insertRunning({
    kind: request.kind,
    setName: setNameFor(id, request.kind, now),
    appVersion: deps.config.appVersion,
    changelogTag: tag?.name ?? null,
    scheduledFor: request.scheduledFor ?? null,
    createdBy: request.createdBy ?? null,
    createdAt: now,
  });
}

/**
 * One backup: database dump in one snapshot, attachments added since the previous
 * backup (or a full copy), manifest, encryption for off-box copies, pg_restore --list,
 * then retention. Every failure is recorded on the row and published as backup.failed.
 */
export async function runBackup(
  deps: SystemDependencies,
  request: RunBackupRequest,
): Promise<BackupRecord> {
  const now = deps.now?.() ?? new Date();
  const repository = createBackupRepository(deps.sql);
  const previousGood = await repository.latest({ status: 'succeeded' });
  try {
    await guardDiskSpace(deps, previousGood?.sizeBytes ?? null);
  } catch (error) {
    if (error instanceof BackupRefusedError) {
      await publishSystemEvent(deps, 'backup.failed', {
        backupId: request.existing?.id ?? null,
        kind: request.kind,
        reason: 'disk_space',
        message: error.message,
      });
      if (request.existing) await repository.markFailed(request.existing.id, error.message, now);
    }
    throw error;
  }

  const record = await createRow(deps, request, now);
  const staging = path.join(deps.config.backupDir, '.staging', record.setName);
  try {
    await mkdir(staging, { recursive: true, mode: 0o750 });
    const dumpFile = path.join(staging, DATABASE_PART);
    const dump = await dumpDatabase(deps.sql, deps.pgTools, deps.config.databaseUrl, dumpFile);
    await deps.pgTools.list(dumpFile);

    const destinations = await resolveDestinations(deps);
    const current = await scanAttachments(attachmentsDir(deps.config.dataDir));
    const plan = planAttachments({
      setName: record.setName,
      current,
      previous: await loadPreviousBackup(repository, destinations),
      forceFull: request.kind === 'pre_upgrade',
      now,
    });
    const archive = await stageAttachments(deps, staging, plan.files);
    const encryption = await readSetting(deps.settings, 'system.backups.encryption');
    const index = serializeIndex(current);

    const manifestFor = (variant: StoredVariant) =>
      buildManifest({
        id: record.id,
        setName: record.setName,
        kind: record.kind,
        createdAt: record.createdAt,
        appVersion: record.appVersion,
        changelogTag: record.changelogTag,
        modules: deps.modules(),
        database: {
          ...variant.database,
          serverVersion: dump.serverVersion,
          rowCounts: dump.rowCounts,
        },
        attachments: {
          mode: plan.mode,
          chain: plan.chain,
          chainStartedAt: plan.chainStartedAt,
          fileCount: plan.files.length,
          totalFileCount: current.size,
          archive: variant.attachments,
          index: ATTACHMENTS_INDEX,
        },
        encryption: variant.encrypted ? { algorithm: ENCRYPTION_ALGORITHM } : null,
      });
    const stored = await storeSet({
      staged: {
        setName: record.setName,
        database: { path: dumpFile, name: DATABASE_PART, digest: dump },
        attachments: archive,
        index,
      },
      destinations,
      encryptLocal: encryption.local,
      passphrase: deps.config.backupPassphrase,
      manifestFor,
    });
    const [rowVariant] = stored.variants.values();
    if (!rowVariant) throw new Error('No backup destination is configured');
    const manifest = manifestFor(rowVariant);
    const completedAt = deps.now?.() ?? new Date();
    await repository.markSucceeded(record.id, {
      manifest,
      locations: stored.locations,
      attachmentMode: plan.mode,
      baseBackupId: plan.baseBackupId,
      encrypted: [...stored.variants.values()].some((variant) => variant.encrypted),
      sizeBytes: dump.sizeBytes + (archive?.digest.sizeBytes ?? 0),
      databaseBytes: dump.sizeBytes,
      attachmentsBytes: archive?.digest.sizeBytes ?? 0,
      verifiedAt: completedAt,
      completedAt,
    });
    deps.onGoodBackup?.(completedAt);
    deps.logger.info(
      { backupId: record.id, set: record.setName, kind: record.kind, mode: plan.mode },
      'backup succeeded',
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await repository.markFailed(record.id, message, deps.now?.() ?? new Date());
    await publishSystemEvent(
      deps,
      'backup.failed',
      { backupId: record.id, kind: record.kind, reason: 'error', message },
      record.id,
    );
    throw error;
  } finally {
    await rm(staging, { recursive: true, force: true });
  }

  try {
    await pruneBackups(deps);
  } catch (error) {
    deps.logger.error({ err: error }, 'backup retention failed; old backups were kept');
  }
  const done = await repository.get(record.id);
  if (!done) throw new Error(`backup ${record.id} disappeared`);
  return done;
}
