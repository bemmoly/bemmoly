import type { FastifyPluginAsync } from 'fastify';
import type { RuntimesController } from '../controllers/runtimes.controller.ts';

/** Clusters and application runtimes under /api/v1/pipelines. */
export function runtimesRoutes(controller: RuntimesController): FastifyPluginAsync {
  return async (app) => {
    app.get('/clusters', async (request) => controller.clusters(request));
    app.post('/clusters', async (request, reply) => controller.addCluster(request, reply));
    app.post('/clusters/:id/check', async (request) => controller.checkCluster(request));
    app.delete('/clusters/:id', async (request, reply) => controller.removeCluster(request, reply));
    app.get('/applications/:key/runtimes', async (request) => controller.runtimes(request));
    app.put('/applications/:key/runtimes/:environment', async (request) =>
      controller.setRuntime(request),
    );
  };
}
