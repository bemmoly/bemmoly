import type { FastifyPluginAsync } from 'fastify';
import type { BoardsController } from '../controllers/boards.controller.ts';

/** Boards under /api/v1/work; `:key` on a project path is its key or its id. */
export function boardsRoutes(controller: BoardsController): FastifyPluginAsync {
  return async (app) => {
    app.get('/projects/:key/boards', async (request) => controller.listForProject(request));
    app.get('/boards', async (request) => controller.list(request));
    app.post('/boards', async (request, reply) => controller.create(request, reply));
    app.get('/boards/:id', async (request) => controller.get(request));
    app.patch('/boards/:id', async (request) => controller.update(request));
    app.delete('/boards/:id', async (request, reply) => controller.remove(request, reply));
    app.get('/boards/:id/view', async (request) => controller.view(request));
  };
}
