import type { BackupSchedule } from '@bemmoly/shared';
import { audit, can, emit, type MockDb } from '../db.ts';
import { bodyOf, fail, notFound, ok, page, type MockRoute } from '../types.ts';

const adminOnly =
  (handle: MockRoute['handle']): MockRoute['handle'] =>
  (request, db) =>
    can(db, 'workspace.delete')
      ? handle(request, db)
      : fail(403, 'forbidden', 'Only org admins can do that.');

function setModuleState(db: MockDb, id: string, state: 'enabled' | 'disabled') {
  const module = db.adminModules.find((entry) => entry.id === id);
  if (!module) return notFound(`Module ${id}`);
  if (module.pinnedByEnv)
    return fail(409, 'conflict', 'BEMMOLY_MODULES pins the module set on this install.');
  module.state = state;
  if (state === 'disabled') db.manifests = db.manifests.filter((entry) => entry.id !== id);
  else if (!db.manifests.some((entry) => entry.id === id)) {
    db.manifests.push({
      id,
      version: module.version,
      navigation: [{ id, label: module.name, path: `/${id}`, placement: 'top' }],
    });
  }
  audit(db, `module.${state}`, 'module', id);
  emit(db, `module.${state}`, [id]);
  return ok();
}

export const operationsRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/admin/modules',
    handle: adminOnly((_, db) => ok({ items: db.adminModules })),
  },
  {
    method: 'POST',
    pattern: '/api/v1/admin/modules/:id/enable',
    handle: adminOnly((request, db) => setModuleState(db, request.params['id'] ?? '', 'enabled')),
  },
  {
    method: 'POST',
    pattern: '/api/v1/admin/modules/:id/disable',
    handle: adminOnly((request, db) => setModuleState(db, request.params['id'] ?? '', 'disabled')),
  },
  {
    method: 'POST',
    pattern: '/api/v1/admin/modules/:id/remove-data',
    handle: adminOnly((request, db) => {
      const module = db.adminModules.find((entry) => entry.id === request.params['id']);
      if (!module) return notFound('That module');
      if (module.state === 'enabled')
        return fail(409, 'conflict', 'Disable the module before removing its data.');
      if (bodyOf<{ confirm: string }>(request).confirm !== module.id) {
        return fail(400, 'validation_failed', `Type ${module.id} to confirm.`);
      }
      module.hasData = false;
      module.dataSizeBytes = 0;
      audit(db, 'module.data_removed', 'module', module.id);
      return ok();
    }),
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
      audit(db, 'backup.restored', 'backup', entry.id);
      return { status: 202 };
    }),
  },
  { method: 'GET', pattern: '/api/v1/admin/updates', handle: adminOnly((_, db) => ok(db.updates)) },
  {
    method: 'POST',
    pattern: '/api/v1/admin/updates/check',
    handle: adminOnly((_, db) => {
      db.updates.lastCheckedAt = new Date().toISOString();
      return ok(db.updates);
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
