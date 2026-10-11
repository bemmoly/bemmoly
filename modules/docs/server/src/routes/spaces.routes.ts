import type { FastifyPluginAsync } from 'fastify';
import type { SpacesController } from '../controllers/spaces.controller.ts';

/** Mounted at /api/v1/docs/spaces behind the kernel's module gate. */
export function spacesRoutes(controller: SpacesController): FastifyPluginAsync {
  return async (app) => {
    app.get('/spaces', async (request) => controller.list(request));
    app.post('/spaces', async (request, reply) => controller.create(request, reply));
    app.get('/spaces/:spaceKey', async (request) => controller.get(request));
    app.patch('/spaces/:spaceKey', async (request) => controller.update(request));
    app.delete('/spaces/:spaceKey', async (request, reply) => controller.remove(request, reply));
  };
}
