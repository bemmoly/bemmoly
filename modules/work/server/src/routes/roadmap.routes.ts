import type { FastifyPluginAsync } from 'fastify';
import type { RoadmapController } from '../controllers/roadmap.controller.ts';

/**
 * The roadmap and its forecasts under /api/v1/work. Dates move through the issue and version
 * PATCHes, so this area only reads.
 */
export function roadmapRoutes(controller: RoadmapController): FastifyPluginAsync {
  return async (app) => {
    app.get('/roadmap', async (request) => controller.view(request));
  };
}
