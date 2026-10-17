import { IMPORT_FILE_MAX_BYTES } from '@bemmoly/shared';
import type { FastifyPluginAsync } from 'fastify';
import type { ImportsController } from '../controllers/imports.controller.ts';

/** A CSV travels as JSON text; escaping can grow it, so the body may be a little larger. */
const CREATE_BODY_LIMIT = Math.ceil(IMPORT_FILE_MAX_BYTES * 1.5);

/**
 * Settings › Import under /api/v1/admin: the sources enabled modules offer, and import jobs
 * from connection (discover) through selection (plan) to a run, its progress and its report.
 */
export function importsRoutes(controller: ImportsController): FastifyPluginAsync {
  return async (app) => {
    app.get('/admin/import-sources', async (request) => controller.sources(request));
    app.get('/admin/imports', async (request) => controller.list(request));
    app.post('/admin/imports', { bodyLimit: CREATE_BODY_LIMIT }, async (request, reply) =>
      controller.create(request, reply),
    );
    app.get('/admin/imports/:id', async (request) => controller.get(request));
    app.patch('/admin/imports/:id', async (request) => controller.update(request));
    app.get('/admin/imports/:id/containers', async (request) => controller.containers(request));
    app.post('/admin/imports/:id/containers/counts', async (request) => controller.count(request));
    app.get('/admin/imports/:id/targets', async (request) => controller.targets(request));
    app.get('/admin/imports/:id/people', async (request) => controller.people(request));
    app.get('/admin/imports/:id/selection', async (request) => controller.selection(request));
    app.patch('/admin/imports/:id/selection', async (request) => controller.select(request));
    app.get('/admin/imports/:id/skips.csv', async (request, reply) =>
      controller.skips(request, reply),
    );
    app.post('/admin/imports/:id/run', async (request) => controller.run(request));
    app.post('/admin/imports/:id/cancel', async (request) => controller.cancel(request));
  };
}
