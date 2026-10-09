import type { FastifyPluginAsync } from 'fastify';
import type { SchemesController } from '../controllers/schemes.controller.ts';

/** A project's schemes against the org defaults; the project is named by key or id. */
export function schemesRoutes(controller: SchemesController): FastifyPluginAsync {
  return async (app) => {
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
