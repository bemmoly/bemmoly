import {
  NotFoundError,
  type Backup,
  type BackupListQuery,
  type BackupListResponse,
} from '@bemmoly/shared';
import { PassThrough, type Readable } from 'node:stream';
import type { Actor } from '../../../contracts/authz.ts';
import type { RequestMeta } from '../../audit/index.ts';
import type { SystemDependencies } from '../deps.ts';
import { SYSTEM_CAPABILITY } from '../authorize.ts';
import { recordBackupAudit, withBackupAudit, type BackupAudit } from './audit.ts';
import { BACKUP_JOB } from './jobs.ts';
import { setNameFor } from './manifest.ts';
import { createBackupRepository, toBackupDto } from './repository.ts';
import { restoreBackup } from './restore.ts';
import { runBackup } from './run-backup.ts';
import { verifyBackup, type VerifyResult } from './verify.ts';

const workspace = { kind: 'workspace' } as const;

async function requireSystem(deps: SystemDependencies, actor: Actor): Promise<void> {
  await deps.authorize(actor, SYSTEM_CAPABILITY, workspace);
}

/** Runs work after the response when no job queue is wired, logging any failure. */
function inBackground(deps: SystemDependencies, label: string, work: () => Promise<unknown>): void {
  work().catch((error: unknown) => deps.logger.error({ err: error }, `${label} failed`));
}

export async function listBackups(
  deps: SystemDependencies,
  actor: Actor,
  query: BackupListQuery,
): Promise<BackupListResponse> {
  await requireSystem(deps, actor);
  const rows = await createBackupRepository(deps.sql).list({
    limit: query.limit + 1,
    ...(query.cursor ? { cursor: query.cursor } : {}),
    ...(query.kind ? { kind: query.kind } : {}),
  });
  const page = rows.slice(0, query.limit);
  return {
    items: page.map(toBackupDto),
    nextCursor: rows.length > query.limit ? (page.at(-1)?.id ?? null) : null,
  };
}

export async function getBackup(
  deps: SystemDependencies,
  actor: Actor,
  id: string,
): Promise<Backup> {
  await requireSystem(deps, actor);
  const record = await createBackupRepository(deps.sql).get(id);
  if (!record) throw new NotFoundError(`No backup ${id}`);
  return toBackupDto(record);
}

const auditOf = (actor: Actor, meta: RequestMeta | undefined): BackupAudit => ({
  actor,
  ...(meta ? { meta } : {}),
});

/** "Back up now": the row exists at once so the list shows it running. */
export async function startManualBackup(
  deps: SystemDependencies,
  actor: Actor,
  meta?: RequestMeta,
): Promise<Backup> {
  await requireSystem(deps, actor);
  const now = deps.now?.() ?? new Date();
  const id = crypto.randomUUID();
  const changelogTag = (await deps.changelog?.latestTag().catch(() => null)) ?? null;
  const record = await withBackupAudit(
    deps,
    auditOf(actor, meta),
    (repository) =>
      repository.insertRunning({
        id,
        kind: 'manual',
        setName: setNameFor(id, 'manual', now),
        appVersion: deps.config.appVersion,
        changelogTag,
        scheduledFor: null,
        createdBy: actor.userId ?? null,
        createdAt: now,
      }),
    (inserted) => ({
      action: 'backup.started',
      backupId: inserted.id,
      after: { kind: inserted.kind, setName: inserted.setName, status: inserted.status },
    }),
  );
  if (deps.jobs) {
    await deps.jobs.enqueue(
      BACKUP_JOB,
      { kind: 'manual', backupId: record.id },
      { key: record.id, singleton: true },
    );
  } else {
    inBackground(deps, 'manual backup', () =>
      runBackup(deps, { kind: 'manual', existing: record }),
    );
  }
  return toBackupDto(record);
}

/** Starts a restore; progress is the maintenance page, the result is in the logs and the list. */
export async function requestRestore(
  deps: SystemDependencies,
  actor: Actor,
  id: string,
  meta?: RequestMeta,
): Promise<{ accepted: true }> {
  await requireSystem(deps, actor);
  const record = await createBackupRepository(deps.sql).get(id);
  if (!record || record.status !== 'succeeded')
    throw new NotFoundError(`No completed backup ${id}`);
  deps.logger.warn({ backupId: id, actor: actor.id }, 'restore requested');
  const audit = auditOf(actor, meta);
  // The restore replaces the database, audit log included, so its row is written
  // afterwards, into the database it restored.
  inBackground(deps, 'restore', async () => {
    try {
      const result = await restoreBackup(deps, record.setName);
      await recordBackupAudit(deps, audit, {
        action: 'backup.restored',
        backupId: id,
        after: {
          setName: result.setName,
          backupVersion: result.backupVersion,
          rolledBackDatabase: result.rolledBackDatabase,
          attachmentsRestored: result.attachmentsRestored,
          pendingChangesets: result.pendingChangesets,
        },
      });
    } catch (error) {
      await recordBackupAudit(deps, audit, {
        action: 'backup.restore_failed',
        backupId: id,
        after: {
          setName: record.setName,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  });
  return { accepted: true };
}

export async function requestVerify(
  deps: SystemDependencies,
  actor: Actor,
  id: string,
  depth: 'list' | 'restore',
  meta?: RequestMeta,
): Promise<VerifyResult | { accepted: true }> {
  await requireSystem(deps, actor);
  const audit = auditOf(actor, meta);
  if (depth === 'list') return verifyBackup(deps, id, 'list', audit);
  inBackground(deps, 'restore drill', () => verifyBackup(deps, id, 'restore', audit));
  return { accepted: true };
}

/** A tar of the set's folder for an off-site copy by hand; local sets only. */
export async function openBackupDownload(
  deps: SystemDependencies,
  actor: Actor,
  id: string,
): Promise<{ filename: string; body: Readable }> {
  await requireSystem(deps, actor);
  const record = await createBackupRepository(deps.sql).get(id);
  if (
    !record ||
    record.status !== 'succeeded' ||
    !record.locations.some((l) => l.destination === 'local')
  ) {
    throw new NotFoundError(`Backup ${id} has no copy on this machine`);
  }
  const body = new PassThrough();
  deps.tar.create(deps.config.backupDir, [record.setName], body).catch((error: unknown) => {
    deps.logger.error({ err: error, backupId: id }, 'backup download failed');
    body.destroy(error instanceof Error ? error : new Error(String(error)));
  });
  return { filename: `${record.setName}.tar`, body };
}
