import type { BackupSchedule, UpdateStatus } from '@bemmoly/shared';
import { audit, can, emit, type MockDb } from '../db.ts';
import { bodyOf, fail, notFound, ok, page, type MockRoute } from '../types.ts';

/** Settings-like pages (backups, updates, system) are assumed to need workspace.settings.manage. */
const adminOnly =
  (handle: MockRoute['handle'], capability = 'workspace.settings.manage'): MockRoute['handle'] =>
  (request, db) =>
    can(db, capability) ? handle(request, db) : fail(403, 'forbidden', 'You cannot do that.');

const MODULES = 'workspace.modules.manage';
const PINNED = 'BEMMOLY_MODULES pins the module set on this install.';

function setModuleState(db: MockDb, id: string, enabled: boolean) {
  const module = db.adminModules.find((entry) => entry.id === id);
  if (!module) return notFound(`Module ${id}`);
  if (db.modulesPinned) return fail(409, 'conflict', PINNED);
  module.enabled = enabled;
  module.enabledAt = enabled ? new Date().toISOString() : null;
  if (!enabled) db.manifests = db.manifests.filter((entry) => entry.id !== id);
  else if (!db.manifests.some((entry) => entry.id === id)) {
    const label = id.charAt(0).toUpperCase() + id.slice(1);
    db.manifests.push({
      id,
      version: module.version,
      navigation: [{ id, label, path: `/${id}`, placement: 'top' }],
    });
  }
  audit(db, enabled ? 'module.enabled' : 'module.disabled', 'module', id);
  emit(db, 'modules.changed', [id]);
  return ok();
}

export const operationsRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/admin/modules',
    handle: adminOnly((_, db) => ok({ items: db.adminModules, pinned: db.modulesPinned }), MODULES),
  },
  {
    method: 'POST',
    pattern: '/api/v1/admin/modules/:id/enable',
    handle: adminOnly(
      (request, db) => setModuleState(db, request.params['id'] ?? '', true),
      MODULES,
    ),
  },
  {
    method: 'POST',
    pattern: '/api/v1/admin/modules/:id/disable',
    handle: adminOnly(
      (request, db) => setModuleState(db, request.params['id'] ?? '', false),
      MODULES,
    ),
  },
  {
    method: 'POST',
    pattern: '/api/v1/admin/modules/:id/remove-data',
    handle: adminOnly((request, db) => {
      const module = db.adminModules.find((entry) => entry.id === request.params['id']);
      if (!module) return notFound('That module');
      if (db.modulesPinned) return fail(409, 'conflict', PINNED);
      if (module.enabled)
        return fail(409, 'conflict', 'Disable the module before removing its data.');
      if (bodyOf<{ confirm: string }>(request).confirm !== module.id) {
        return fail(400, 'validation_failed', `Type ${module.id} to confirm.`);
      }
      module.changelogState = 'removed';
      module.versionInstalled = null;
      audit(db, 'module.data_removed', 'module', module.id);
      return ok();
    }, MODULES),
  },
  {
    method: 'GET',
    pattern: '/api/v1/admin/backups',
    handle: adminOnly((request, db) => {
      const lastGood = db.backups.find((entry) => entry.status === 'succeeded');
      const next = new Date();
      next.setUTCHours(
        Number(schedule(db).timeOfDay.slice(0, 2)),
        Number(schedule(db).timeOfDay.slice(3)),
        0,
        0,
      );
      if (next.getTime() < Date.now()) next.setUTCDate(next.getUTCDate() + 1);
      return ok({
        ...page(db.backups, request),
        summary: {
          lastGoodAt: lastGood?.finishedAt ?? null,
          nextRunAt: next.toISOString(),
          oneDisk: schedule(db).s3 === null,
        },
      });
    }),
  },
  {
    method: 'POST',
    pattern: '/api/v1/admin/backups',
    handle: adminOnly((_, db) => {
      const now = new Date().toISOString();
      const entry = {
        id: `bk-${String(db.backups.length + 1).padStart(4, '0')}-${Date.now() % 1000}`,
        kind: 'manual' as const,
        tier: null,
        status: 'succeeded' as const,
        startedAt: now,
        finishedAt: now,
        sizeBytes: 413_000_000,
        appVersion: db.updates.currentVersion,
        destination: schedule(db).localPath,
        verification: 'verified' as const,
        verifiedAt: now,
        error: null,
      };
      db.backups.unshift(entry);
      db.system.lastBackup = entry;
      audit(db, 'backup.completed', 'backup', entry.id);
      emit(db, 'backup.completed', [entry.id]);
      return ok(entry, 201);
    }),
  },
  {
    method: 'POST',
    pattern: '/api/v1/admin/backups/:id/verify',
    handle: adminOnly((request, db) => {
      const entry = db.backups.find((backup) => backup.id === request.params['id']);
      if (!entry) return notFound('That backup');
      if (entry.status !== 'succeeded')
        return fail(409, 'conflict', 'Only a finished backup can be drilled.');
      entry.verification = 'verified';
      entry.verifiedAt = new Date().toISOString();
      return ok(entry);
    }),
  },
  {
    method: 'POST',
    pattern: '/api/v1/admin/backups/:id/restore',
    handle: adminOnly((request, db) => {
      const entry = db.backups.find((backup) => backup.id === request.params['id']);
      if (!entry) return notFound('That backup');
      if (bodyOf<{ confirm: string }>(request).confirm !== entry.id) {
        return fail(400, 'validation_failed', `Type ${entry.id} to confirm.`);
      }
      audit(db, 'backup.restored', 'backup', entry.id);
      return { status: 202 };
    }),
  },
  {
    method: 'GET',
    pattern: '/api/v1/admin/updates',
    handle: adminOnly((_, db) => ok(updateStatus(db, true))),
  },
  {
    method: 'POST',
    pattern: '/api/v1/admin/updates/check',
    handle: adminOnly((_, db) => {
      db.updates.lastCheckedAt = new Date().toISOString();
      return ok(updateStatus(db, false));
    }),
  },
  {
    method: 'POST',
    pattern: '/api/v1/admin/updates/apply',
    handle: adminOnly((request, db) => {
      const version = bodyOf<{ version: string }>(request).version ?? '';
      if (db.updates.latest?.version !== version)
        return fail(409, 'conflict', `${version} is not the latest release on this channel.`);
      db.updates.job = {
        action: 'update',
        state: 'running',
        message: `Backing up, then updating to ${version}…`,
      };
      audit(db, 'update.started', 'system', version);
      return ok(db.updates);
    }),
  },
  {
    method: 'POST',
    pattern: '/api/v1/admin/updates/rollback',
    handle: adminOnly((_, db) => {
      if (!db.updates.previous)
        return fail(409, 'conflict', 'There is no earlier version to roll back to.');
      db.updates.job = {
        action: 'rollback',
        state: 'running',
        message: `Rolling back to ${db.updates.previous.version}…`,
      };
      audit(db, 'update.rollback_started', 'system', db.updates.previous.version);
      return ok(db.updates);
    }),
  },
  { method: 'GET', pattern: '/api/v1/admin/system', handle: adminOnly((_, db) => ok(db.system)) },
  {
    method: 'GET',
    pattern: '/api/v1/audit-log',
    handle: (request, db) => {
      if (!can(db, 'workspace.audit.view'))
        return fail(403, 'forbidden', 'You cannot view the audit log.');
      const q = (name: string) => request.query.get(name) ?? '';
      const items = db.audit.filter(
        (entry) =>
          (!q('action') || entry.action.startsWith(q('action'))) &&
          (!q('actorId') || entry.actorId === q('actorId')) &&
          (!q('targetKind') || entry.targetKind === q('targetKind')) &&
          (!q('targetId') || entry.targetId === q('targetId')) &&
          (!q('since') || entry.createdAt >= q('since')) &&
          (!q('until') || entry.createdAt <= q('until')),
      );
      return ok(page(items, request, 25));
    },
  },
];

function schedule(db: MockDb): BackupSchedule {
  return db.settings['backups.schedule'] as BackupSchedule;
}

/**
 * The channel follows the `updates.channel` setting. A running job finishes on
 * the next poll, so the page shows the updater's progress and then its result.
 */
function updateStatus(db: MockDb, advance: boolean): UpdateStatus {
  const updates = db.updates;
  updates.channel = (db.settings['updates.channel'] as UpdateStatus['channel']) ?? updates.channel;
  if (!advance || updates.job?.state !== 'running') return updates;
  const now = new Date().toISOString();
  if (updates.job.action === 'update' && updates.latest) {
    const from = updates.currentVersion;
    updates.currentVersion = updates.latest.version;
    updates.previous = {
      version: from,
      updatedAt: now,
      availableUntil: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      rollbackMode: updates.latest.irreversible ? 'restore' : 'code',
      discardCount: updates.latest.irreversible ? 0 : null,
      droppedFields: [],
    };
    updates.latest = null;
    updates.job = {
      action: 'update',
      state: 'succeeded',
      message: `Updated to ${updates.currentVersion}.`,
    };
  } else if (updates.job.action === 'rollback' && updates.previous) {
    updates.currentVersion = updates.previous.version;
    updates.previous = null;
    updates.job = {
      action: 'rollback',
      state: 'succeeded',
      message: `Rolled back to ${updates.currentVersion}.`,
    };
  }
  db.system.version = updates.currentVersion;
  return updates;
}
