import type { FastifyPluginAsync } from 'fastify';
import type { AdoptionController } from '../controllers/adoption.controller.ts';

/** Adoptions and configuration copies under /api/v1/pipelines. */
export function adoptionRoutes(controller: AdoptionController): FastifyPluginAsync {
  return async (app) => {
    app.get('/environments/:key/adoptions', async (request) => controller.plan(request));
    app.post('/environments/:key/adoptions', async (request, reply) =>
      controller.adopt(request, reply),
    );
    app.get('/environments/:key/copies', async (request) => controller.copyPlan(request));
    app.post('/environments/:key/copies', async (request, reply) =>
      controller.copy(request, reply),
    );
  };
}
