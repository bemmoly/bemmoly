import type { FastifyPluginAsync } from 'fastify';
import type { InitiativesController } from '../controllers/initiatives.controller.ts';

/**
 * Initiatives under /api/v1/work/initiatives. Archiving is a verb with no noun of its own;
 * an initiative's timeline is the roadmap read with `?initiative=`.
 */
export function initiativesRoutes(controller: InitiativesController): FastifyPluginAsync {
  return async (app) => {
    app.get('/initiatives', async (request) => controller.list(request));
    app.post('/initiatives', async (request, reply) => controller.create(request, reply));
    app.get('/initiatives/:id', async (request) => controller.get(request));
    app.patch('/initiatives/:id', async (request) => controller.update(request));
    app.post('/initiatives/:id/archive', async (request) => controller.archive(request));
    app.post('/initiatives/:id/unarchive', async (request) => controller.unarchive(request));
    app.post('/initiatives/:id/epics', async (request, reply) =>
      controller.linkEpic(request, reply),
    );
    app.delete('/initiatives/:id/epics/:epicId', async (request, reply) =>
      controller.unlinkEpic(request, reply),
    );
  };
}
