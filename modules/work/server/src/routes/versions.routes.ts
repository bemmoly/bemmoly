import type { FastifyPluginAsync } from 'fastify';
import type { VersionsController } from '../controllers/versions.controller.ts';

/** A project's versions under /api/v1/work/projects/:key/versions. */
export function versionsRoutes(controller: VersionsController): FastifyPluginAsync {
  return async (app) => {
    app.get('/projects/:key/versions', async (request) => controller.list(request));
    app.post('/projects/:key/versions', async (request, reply) =>
      controller.create(request, reply),
    );
    app.patch('/projects/:key/versions/:id', async (request) => controller.update(request));
    app.delete('/projects/:key/versions/:id', async (request, reply) =>
      controller.remove(request, reply),
    );
  };
}
