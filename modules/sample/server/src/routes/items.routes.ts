import type { FastifyPluginAsync } from 'fastify';
import type { ItemsController } from '../controllers/items.controller.ts';

/** Mounted at /api/v1/sample behind the kernel's module gate. */
export function sampleRoutes(controller: ItemsController): FastifyPluginAsync {
  return async (app) => {
    app.get('/items', async () => controller.list());
    app.post('/items', async (request, reply) => controller.create(request, reply));
    app.post('/pings', async (request, reply) => controller.ping(request, reply));
    app.get('/greeting', async () => controller.greeting());
  };
}
