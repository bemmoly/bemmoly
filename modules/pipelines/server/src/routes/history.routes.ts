import type { FastifyPluginAsync } from 'fastify';
import type { HistoryController } from '../controllers/history.controller.ts';

/** Current state and What changed? under /api/v1/pipelines. */
export function historyRoutes(controller: HistoryController): FastifyPluginAsync {
  return async (app) => {
    app.get('/current', async (request) => controller.current(request));
    app.get('/changes', async (request) => controller.changes(request));
  };
}
