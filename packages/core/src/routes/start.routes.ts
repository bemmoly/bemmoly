import type { FastifyPluginAsync } from 'fastify';
import type { StartController } from '../controllers/start.controller.ts';

/** GET /api/v1/start-summaries: the start page asks every module the person can open. */
export function startRoutes(controller: StartController): FastifyPluginAsync {
  return async (app) => {
    app.get('/start-summaries', async (request) => controller.summaries(request));
  };
}
