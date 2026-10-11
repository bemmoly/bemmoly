import type { FastifyPluginAsync } from 'fastify';
import type { SchemesController } from '../controllers/schemes.controller.ts';

/**
 * The org defaults and who follows them at /schemes; a project's schemes against them at
 * /projects/:key/schemes, the project named by key or id.
 */
export function schemesRoutes(controller: SchemesController): FastifyPluginAsync {
  return async (app) => {
    app.get('/schemes', async (request) => controller.usage(request));
    app.get('/projects/:key/schemes', async (request) => controller.list(request));
    app.get('/projects/:key/schemes/:kind/diff', async (request) => controller.diff(request));
    app.post('/projects/:key/schemes/:kind/override', async (request, reply) =>
      controller.override(request, reply),
    );
    app.post('/projects/:key/schemes/:kind/reset', async (request, reply) =>
      controller.reset(request, reply),
    );
  };
}
