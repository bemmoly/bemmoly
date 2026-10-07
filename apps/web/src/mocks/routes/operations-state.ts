import type { Backup, RollbackMode } from '@bemmoly/shared';
import { audit, emit, type MockDb } from '../db.ts';
import { LOCAL_BACKUPS } from '../seed/operations.ts';
import { newId } from '../seed/time.ts';
import { ok, type MockResponse, type MockRoute } from '../types.ts';

/**
 * Restores, updates and rollbacks put the server in maintenance: writes answer 503
 * until it ends. The mock ends it after a few reads, so pages show the banner and
 * then recover, as they would against the real updater.
 */
const maintenanceReads = new WeakMap<MockDb, number>();
/** Reads of the updates overview that still show the updater running. */
const jobReads = new WeakMap<MockDb, number>();

export function enterMaintenance(db: MockDb, reason: string) {
  db.system.maintenance = { active: true, reason };
  maintenanceReads.set(db, 2);
  jobReads.set(db, 1);
}

export function readTick(db: MockDb) {
  const left = maintenanceReads.get(db);
  if (left === undefined) return;
  if (left > 0) maintenanceReads.set(db, left - 1);
  else {
    maintenanceReads.delete(db);
    db.system.maintenance = { active: false, reason: null };
  }
}

export const writable =
  (handle: MockRoute['handle']): MockRoute['handle'] =>
  (request, db) =>
    db.system.maintenance.active
      ? {
          status: 503,
          body: {
            code: 'maintenance',
            message: db.system.maintenance.reason,
            requestId: 'mock-503',
          },
        }
      : handle(request, db);

export const findBackup = (db: MockDb, id: string | undefined) =>
  db.backups.find((entry) => entry.id === id);

export function runBackup(db: MockDb): MockResponse {
  const now = new Date().toISOString();
  const id = newId();
  const s3 = Boolean(db.settings['system.backups.s3']);
  const entry: Backup = {
    id,
    kind: 'manual',
    status: 'succeeded',
    createdAt: now,
    completedAt: now,
    appVersion: db.updates.current.version,
    changelogTag: db.updates.current.version,
    sizeBytes: 413_000_000,
    attachmentMode: 'incremental',
    baseBackupId: db.backups[0]?.id ?? null,
    encrypted: s3,
    locations: [
      { destination: 'local', location: `${LOCAL_BACKUPS}/${id}` },
      ...(s3 ? [{ destination: 's3' as const, location: `bemmoly/${id}` }] : []),
    ],
    verification: { state: 'listed', checkedAt: now, message: null },
    error: null,
  };
  db.backups.unshift(entry);
  audit(db, 'backup.completed', 'backup', id);
  emit(db, 'system.backup', [id]);
  return ok(entry, 201);
}

/** The overview with the settings applied; a running updater job finishes a read later. */
export function overview(db: MockDb) {
  const updates = db.updates;
  updates.current.channel =
    (db.settings['system.updates.channel'] as 'stable' | 'beta' | undefined) ??
    updates.current.channel;
  updates.checks.enabled = (db.settings['system.updates.check'] as boolean | undefined) ?? true;
  if (updates.updater.state !== 'running') return updates;
  const left = jobReads.get(db) ?? 0;
  if (left > 0) {
    jobReads.set(db, left - 1);
    return updates;
  }
  const now = new Date().toISOString();
  const from = updates.current.version;
  if (updates.updater.step === 'rollback' && updates.rollback) {
    updates.current = {
      ...updates.current,
      version: updates.rollback.toVersion,
      updatedAt: now,
      previousVersion: null,
    };
    updates.rollback = null;
  } else if (updates.available) {
    const to = updates.available.version;
    const mode: RollbackMode = updates.available.rollback === 'restore' ? 'restore' : 'code';
    updates.current = { ...updates.current, version: to, updatedAt: now, previousVersion: from };
    updates.rollback = {
      fromVersion: to,
      toVersion: from,
      mode,
      summary:
        mode === 'code'
          ? `Swaps back to the ${from} image. Nothing is lost.`
          : `Restores the backup taken before ${to}; changes made since are discarded.`,
      reason: `Rollback from ${to} was planned when it was installed.`,
      schemaChangesets: [],
      discard: mode === 'restore' ? { changes: 0, people: 0, since: now } : null,
      backupId: db.backups[0]?.id ?? null,
      expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    };
    updates.available = null;
  }
  updates.updater = { ...updates.updater, state: 'idle', step: null };
  db.system.version = updates.current.version;
  maintenanceReads.delete(db);
  db.system.maintenance = { active: false, reason: null };
  return updates;
}
