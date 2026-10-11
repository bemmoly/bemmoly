import type { FastifyPluginAsync } from 'fastify';
import type { LqlController } from '../controllers/lql.controller.ts';

/**
 * Mounted at /api/v1/work/issues/query and /issues/summaries behind the kernel's module gate.
 * Static paths, so they win over /issues/:key whatever the registration order.
 */
export function lqlRoutes(controller: LqlController): FastifyPluginAsync {
  return async (app) => {
    app.get('/issues/query', async (request) => controller.query(request));
    app.get('/issues/summaries', async (request) => controller.summaries(request));
  };
}
