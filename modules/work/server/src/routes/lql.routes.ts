import type { FastifyPluginAsync } from 'fastify';
import type { LqlController } from '../controllers/lql.controller.ts';

/** Mounted at /api/v1/work/issues/query behind the kernel's module gate. */
export function lqlRoutes(controller: LqlController): FastifyPluginAsync {
  return async (app) => {
    app.get('/issues/query', async (request) => controller.query(request));
  };
}
