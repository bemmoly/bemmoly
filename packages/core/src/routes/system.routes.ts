import type { FastifyPluginAsync } from 'fastify';
import type { SystemController } from '../controllers/system.controller.ts';
import { MAX_BUNDLE_BYTES } from '../services/system/index.ts';

/** Settings › System, Storage and backups, and Updates. Org admins only (checked in the services). */
export function systemRoutes(controller: SystemController): FastifyPluginAsync {
  return async (app) => {
    // Anonymous by design while setup is open: the wizard shows these checks before any
    // account exists. Once the first admin exists the controller requires a signed-in actor.
    app.get('/admin/system', { config: { anonymous: true } }, (request) =>
      controller.health(request),
    );

    app.get('/admin/backups', (request) => controller.listBackups(request));
    app.post('/admin/backups', (request, reply) => controller.createBackup(request, reply));
    app.get('/admin/backups/:id', (request) => controller.getBackup(request));
    app.post('/admin/backups/:id/restore', (request, reply) =>
      controller.restoreBackup(request, reply),
    );
    app.post('/admin/backups/:id/verify', (request, reply) =>
      controller.verifyBackup(request, reply),
    );
    app.get('/admin/backups/:id/download', (request, reply) =>
      controller.downloadBackup(request, reply),
    );

    app.get('/admin/updates', (request) => controller.updates(request));
    app.post('/admin/updates/apply', (request, reply) => controller.applyUpdate(request, reply));
    app.post('/admin/updates/rollback', (request, reply) => controller.rollback(request, reply));
    await app.register(async (upload) => {
      // The bundle streams to disk; it is never buffered in memory.
      upload.addContentTypeParser('application/octet-stream', (_request, payload, done) =>
        done(null, payload),
      );
      upload.post(
        '/admin/updates/catalog-upload',
        { bodyLimit: MAX_BUNDLE_BYTES },
        (request, reply) => controller.uploadCatalog(request, reply),
      );
    });
  };
}
