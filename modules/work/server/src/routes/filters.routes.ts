import type { FastifyPluginAsync } from 'fastify';
import type { FiltersController } from '../controllers/filters.controller.ts';

/** Saved LQL filters under /api/v1/work/filters. */
export function filtersRoutes(controller: FiltersController): FastifyPluginAsync {
  return async (app) => {
    app.get('/filters', async (request) => controller.list(request));
    app.post('/filters', async (request, reply) => controller.create(request, reply));
    app.get('/filters/:id', async (request) => controller.get(request));
    app.patch('/filters/:id', async (request) => controller.update(request));
    app.delete('/filters/:id', async (request, reply) => controller.remove(request, reply));
  };
}
