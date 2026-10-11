import type { FastifyPluginAsync } from 'fastify';
import type { SprintsController } from '../controllers/sprints.controller.ts';

/** Sprints under /api/v1/work; start and complete are verbs with no noun of their own. */
export function sprintsRoutes(controller: SprintsController): FastifyPluginAsync {
  return async (app) => {
    app.get('/projects/:key/sprints', async (request) => controller.list(request));
    app.post('/projects/:key/sprints', async (request, reply) => controller.create(request, reply));
    app.get('/sprints/:id', async (request) => controller.get(request));
    app.patch('/sprints/:id', async (request) => controller.update(request));
    app.delete('/sprints/:id', async (request, reply) => controller.remove(request, reply));
    app.post('/sprints/:id/start', async (request) => controller.start(request));
    app.post('/sprints/:id/complete', async (request) => controller.complete(request));
  };
}
