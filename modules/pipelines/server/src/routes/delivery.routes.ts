import type { FastifyPluginAsync } from 'fastify';
import type { DeliveryController } from '../controllers/delivery.controller.ts';

/** For you, the map and the environment strip under /api/v1/pipelines. */
export function deliveryRoutes(controller: DeliveryController): FastifyPluginAsync {
  return async (app) => {
    app.get('/for-you', async (request) => controller.forYou(request));
    app.get('/map', async (request) => controller.map(request));
    app.get('/applications/:key/environments', async (request) => controller.strip(request));
  };
}
