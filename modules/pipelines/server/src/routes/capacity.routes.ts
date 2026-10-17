import type { FastifyPluginAsync } from 'fastify';
import type { CapacityController } from '../controllers/capacity.controller.ts';

/** Platform › Capacity under /api/v1/pipelines. */
export function capacityRoutes(controller: CapacityController): FastifyPluginAsync {
  return async (app) => {
    app.get('/capacity', async (request) => controller.read(request));
    app.get('/pools', async (request) => controller.pools(request));
    app.post('/pools', async (request, reply) => controller.create(request, reply));
    app.patch('/pools/:key', async (request) => controller.update(request));
    app.post('/pools/:key/tokens', async (request, reply) => controller.rotate(request, reply));
    app.put('/pools/:key/shares/:teamId', async (request) => controller.share(request));
  };
}
