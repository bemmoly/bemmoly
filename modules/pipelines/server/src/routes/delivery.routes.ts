import type { FastifyPluginAsync } from 'fastify';
import type { DeliveryController } from '../controllers/delivery.controller.ts';
import type { ViewsController } from '../controllers/views.controller.ts';

/** For you, the map, the environment strip and saved views under /api/v1/pipelines. */
export function deliveryRoutes(
  controller: DeliveryController,
  views: ViewsController,
): FastifyPluginAsync {
  return async (app) => {
    app.get('/for-you', async (request) => controller.forYou(request));
    app.get('/map', async (request) => controller.map(request));
    app.get('/applications/:key/environments', async (request) => controller.strip(request));
    app.get('/views', async (request) => views.list(request));
    app.post('/views', async (request, reply) => views.create(request, reply));
    app.delete('/views/:id', async (request, reply) => views.remove(request, reply));
  };
}
