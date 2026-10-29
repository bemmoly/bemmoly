import type { FastifyPluginAsync } from 'fastify';
import type { ExportsController } from '../controllers/exports.controller.ts';

/** Platform › Export under /api/v1/pipelines. */
export function exportsRoutes(controller: ExportsController): FastifyPluginAsync {
  return async (app) => {
    app.get('/exports', async (request) => controller.preview(request));
    app.get('/exports/archive', async (request, reply) => controller.archive(request, reply));
  };
}
