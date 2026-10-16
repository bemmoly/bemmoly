import type { FastifyPluginAsync } from 'fastify';
import type { StatsController } from '../controllers/stats.controller.ts';

/** Field statistics on the Reports screen, under /api/v1/work. */
export function statsRoutes(controller: StatsController): FastifyPluginAsync {
  return async (app) => {
    app.get('/projects/:key/reports/stats', async (request) => controller.stats(request));
  };
}
