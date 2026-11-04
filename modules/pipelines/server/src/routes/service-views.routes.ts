import type { FastifyPluginAsync } from 'fastify';
import type { ServiceViewsController } from '../controllers/service-views.controller.ts';

/** Services, a service's versions and For you's summary under /api/v1/pipelines. */
export function serviceViewsRoutes(controller: ServiceViewsController): FastifyPluginAsync {
  return async (app) => {
    app.get('/services', async (request) => controller.list(request));
    app.get('/services/:key', async (request) => controller.one(request));
    app.get('/services/:key/versions', async (request) => controller.versions(request));
    app.get('/for-you/summary', async (request) => controller.forYou(request));
  };
}
