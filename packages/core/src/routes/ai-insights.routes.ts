import type { FastifyPluginAsync } from 'fastify';
import type { AiInsightsController } from '../controllers/ai-insights.controller.ts';

/**
 * Cached AI insights (issue summary, page TL;DR, sprint pulse, morning brief, consistency):
 * GET /api/v1/ai/insights/:kind/:targetId reads the cache and queues a refresh when stale,
 * POST …/refresh is "Try again", PUT /api/v1/ai/insights/:id/feedback records "Not useful".
 */
export function aiInsightsRoutes(controller: AiInsightsController): FastifyPluginAsync {
  return async (app) => {
    app.get('/ai/insights/:kind/:targetId', async (request) => controller.get(request));
    app.post('/ai/insights/:kind/:targetId/refresh', async (request, reply) =>
      controller.refresh(request, reply),
    );
    app.put('/ai/insights/:id/feedback', async (request, reply) =>
      controller.feedback(request, reply),
    );
  };
}
