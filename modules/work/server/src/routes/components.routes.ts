import type { FastifyPluginAsync } from 'fastify';
import type { ComponentsController } from '../controllers/components.controller.ts';

/** A project's components under /api/v1/work/projects/:key/components. */
export function componentsRoutes(controller: ComponentsController): FastifyPluginAsync {
  return async (app) => {
    app.get('/projects/:key/components', async (request) => controller.list(request));
    app.post('/projects/:key/components', async (request, reply) =>
      controller.create(request, reply),
    );
    app.patch('/projects/:key/components/:id', async (request) => controller.update(request));
    app.delete('/projects/:key/components/:id', async (request, reply) =>
      controller.remove(request, reply),
    );
  };
}
