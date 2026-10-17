import type { FastifyPluginAsync } from 'fastify';
import type { ReleasesController } from '../controllers/releases.controller.ts';

/** Release reads under /api/v1/pipelines; registering one is Bring your CI's endpoint. */
export function releasesRoutes(controller: ReleasesController): FastifyPluginAsync {
  return async (app) => {
    app.get('/releases', async (request) => controller.list(request));
    app.get('/releases/compare', async (request) => controller.compare(request));
    app.get('/releases/:id', async (request) => controller.get(request));
  };
}
