import type { FastifyPluginAsync } from 'fastify';
import type { BacklogController } from '../controllers/backlog.controller.ts';

/** The Backlog screen's read and its drop, under /api/v1/work. */
export function backlogRoutes(controller: BacklogController): FastifyPluginAsync {
  return async (app) => {
    app.get('/projects/:key/backlog', async (request) => controller.get(request));
    app.post('/issues/:key/move', async (request) => controller.move(request));
  };
}
