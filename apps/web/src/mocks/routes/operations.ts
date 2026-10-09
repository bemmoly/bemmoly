import type { EnableModuleBody, ModuleAccessChoice, RollbackMode } from '@bemmoly/shared';
import { shippedManifest } from '../seed/modules.ts';
import { newId } from '../seed/time.ts';
import { audit, can, emit, type MockDb } from '../db.ts';
import { bodyOf, fail, notFound, ok, page, type MockRoute } from '../types.ts';
import {
  enterMaintenance,
  findBackup,
  overview,
  readTick,
  runBackup,
  writable,
} from './operations-state.ts';

const SYSTEM = 'workspace.system.manage';
const MODULES = 'workspace.modules.manage';
const PINNED = 'BEMMOLY_MODULES pins the module set on this install.';

const adminOnly =
  (handle: MockRoute['handle'], capability = SYSTEM): MockRoute['handle'] =>
  (request, db) =>
    can(db, capability) ? handle(request, db) : fail(403, 'forbidden', 'You cannot do that.');

/** The admin's choice on enable, added to any grants the module already has, as the server does. */
function grantAccess(db: MockDb, moduleId: string, access: ModuleAccessChoice) {
  const subjects =
    access.mode === 'everyone'
      ? [{ subjectKind: 'everyone' as const, subjectId: null }]
      : access.mode === 'teams'
        ? (access.teamIds ?? []).map((id) => ({ subjectKind: 'team' as const, subjectId: id }))
        : [];
  for (const subject of subjects) {
    const exists = db.grants.some(
      (grant) =>
        grant.moduleId === moduleId &&
        grant.subjectKind === subject.subjectKind &&
        grant.subjectId === subject.subjectId,
    );
    if (exists) continue;
    db.grants.push({
      id: newId(),
      moduleId,
      ...subject,
      grantedBy: db.signedInAs,
      createdAt: new Date().toISOString(),
    });
  }
}

function setModuleState(db: MockDb, id: string, enabled: boolean, access?: ModuleAccessChoice) {
  const module = db.adminModules.find((entry) => entry.id === id);
  if (!module) return notFound(`Module ${id}`);
  if (db.modulesPinned) return fail(409, 'conflict', PINNED);
  if (access?.mode === 'teams' && !access.teamIds?.length) {
    return fail(400, 'validation_failed', 'Choose at least one team.');
  }
  module.enabled = enabled;
  module.enabledAt = enabled ? new Date().toISOString() : null;
  if (enabled) {
    module.versionInstalled = module.version;
    module.changelogState = 'current';
    module.pendingChangesets = 0;
    grantAccess(db, id, access ?? { mode: 'none' });
  }
  if (!enabled) db.manifests = db.manifests.filter((entry) => entry.id !== id);
  else if (!db.manifests.some((entry) => entry.id === id)) {
    db.manifests.push(shippedManifest(id) ?? { id, version: module.version, navigation: [] });
  }
  audit(db, enabled ? 'module.enabled' : 'module.disabled', 'module', id);
  emit(db, 'modules.changed', [id]);
  return ok(module);
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
      (request, db) =>
        setModuleState(
          db,
          request.params['id'] ?? '',
          true,
          bodyOf<EnableModuleBody>(request).access,
        ),
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
    // Anonymous until the first admin exists, so the wizard's first step can read it.
    method: 'GET',
    pattern: '/api/v1/admin/system',
    anonymous: true,
    handle: (_, db) => {
      if (db.initialized && !can(db, SYSTEM)) {
        return db.signedInAs
          ? fail(403, 'forbidden', 'You cannot do that.')
          : fail(401, 'unauthenticated', 'Sign in to continue.');
      }
      readTick(db);
      return ok(db.system);
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/admin/backups',
    handle: adminOnly((request, db) => {
      readTick(db);
      const kind = request.query.get('kind');
      return ok(
        page(
          db.backups.filter((entry) => !kind || entry.kind === kind),
          request,
          25,
        ),
      );
    }),
  },
  {
    method: 'GET',
    pattern: '/api/v1/admin/backups/:id',
    handle: adminOnly((request, db) => {
      const entry = findBackup(db, request.params['id']);
      return entry ? ok(entry) : notFound('That backup');
    }),
  },
  {
    method: 'POST',
    pattern: '/api/v1/admin/backups',
    handle: adminOnly(writable((_, db) => runBackup(db))),
  },
  {
    method: 'POST',
    pattern: '/api/v1/admin/backups/:id/verify',
    handle: adminOnly(
      writable((request, db) => {
        const entry = findBackup(db, request.params['id']);
        if (!entry) return notFound('That backup');
        if (entry.status !== 'succeeded')
          return fail(409, 'conflict', 'Only a finished backup can be checked.');
        const depth = bodyOf<{ depth: 'list' | 'restore' }>(request).depth ?? 'restore';
        const checkedAt = new Date().toISOString();
        entry.verification = {
          state: depth === 'list' ? 'listed' : 'restored',
          checkedAt,
          message: depth === 'list' ? null : 'Row counts match on issues, pages, users.',
        };
        return depth === 'list' ? ok(entry) : { status: 202 };
      }),
    ),
  },
  {
    method: 'POST',
    pattern: '/api/v1/admin/backups/:id/restore',
    handle: adminOnly(
      writable((request, db) => {
        const entry = findBackup(db, request.params['id']);
        if (!entry) return notFound('That backup');
        if (bodyOf<{ confirm: boolean }>(request).confirm !== true) {
          return fail(400, 'validation_failed', 'Confirm the restore.');
        }
        audit(db, 'backup.restored', 'backup', entry.id);
        enterMaintenance(db, `Restoring the backup from ${entry.createdAt.slice(0, 10)}…`);
        return { status: 202 };
      }),
    ),
  },
  {
    method: 'GET',
    pattern: '/api/v1/admin/updates',
    handle: adminOnly((_, db) => ok(overview(db))),
  },
  {
    method: 'POST',
    pattern: '/api/v1/admin/updates/check',
    handle: adminOnly((_, db) => {
      db.updates.checks = {
        ...db.updates.checks,
        lastCheckedAt: new Date().toISOString(),
        error: null,
      };
      return ok(overview(db));
    }),
  },
  {
    method: 'POST',
    pattern: '/api/v1/admin/updates/apply',
    handle: adminOnly(
      writable((request, db) => {
        const version = bodyOf<{ version: string }>(request).version ?? '';
        const { available, updater } = db.updates;
        if (available?.version !== version)
          return fail(409, 'conflict', `${version} is not the latest release on this channel.`);
        if (updater.mode === 'cli') {
          const command = `sudo bemmoly upgrade ${version}`;
          return fail(
            409,
            'conflict',
            'This install has no updater. Run the command on the server.',
            {
              command,
            },
          );
        }
        db.updates.updater = { ...updater, state: 'running', step: 'backup' };
        enterMaintenance(db, `Backing up, then updating to ${version}…`);
        audit(db, 'update.started', 'system', version);
        return ok({ accepted: true, operation: 'update', target: version }, 202);
      }),
    ),
  },
  {
    method: 'POST',
    pattern: '/api/v1/admin/updates/rollback',
    handle: adminOnly(
      writable((request, db) => {
        const plan = db.updates.rollback;
        if (!plan) return fail(409, 'conflict', 'There is no earlier version to roll back to.');
        if (bodyOf<{ expectedMode: RollbackMode }>(request).expectedMode !== plan.mode) {
          return fail(409, 'conflict', 'The rollback plan changed. Review it and confirm again.');
        }
        db.updates.updater = { ...db.updates.updater, state: 'running', step: 'rollback' };
        enterMaintenance(db, `Rolling back to ${plan.toVersion}…`);
        audit(db, 'update.rollback_started', 'system', plan.toVersion);
        return ok({ accepted: true, operation: 'rollback', target: plan.toVersion }, 202);
      }),
    ),
  },
  {
    method: 'POST',
    pattern: '/api/v1/admin/updates/catalog-upload',
    handle: adminOnly(
      writable((request) => {
        const filename = request.query.get('filename') ?? '';
        if (!/^bemmoly-airgap-[0-9A-Za-z.+-]+\.tar(\.gz)?$/.test(filename)) {
          return fail(400, 'validation_failed', 'Upload a bemmoly-airgap-<version>.tar.gz bundle.');
        }
        const sizeBytes = request.body instanceof Blob ? request.body.size : 0;
        const storedAt = new Date().toISOString();
        return ok({ filename, sizeBytes, sha256: '0'.repeat(64), storedAt }, 201);
      }),
    ),
  },
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
