import type { FastifyPluginAsync } from 'fastify';
import type { DiscoveryController } from '../controllers/discovery.controller.ts';

/** Discovery under /api/v1/pipelines. */
export function discoveryRoutes(controller: DiscoveryController): FastifyPluginAsync {
  return async (app) => {
    app.get('/discovery/proposals', async (request) => controller.proposals(request));
    app.post('/discovery/acceptances', async (request, reply) => controller.accept(request, reply));
    app.post('/discovery/dismissals', async (request, reply) => controller.dismiss(request, reply));
    app.post('/discovery/scans', async (request, reply) => controller.scan(request, reply));
  };
}
