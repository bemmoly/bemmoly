import type { FastifyPluginAsync } from 'fastify';
import type { InsightsController } from '../controllers/insights.controller.ts';

/** Insights under /api/v1/pipelines. */
export function insightsRoutes(controller: InsightsController): FastifyPluginAsync {
  return async (app) => {
    app.get('/insights', async (request) => controller.get(request));
  };
}
