import type { FastifyPluginAsync } from 'fastify';
import type { RunsController } from '../controllers/runs.controller.ts';

/** Runs under /api/v1/pipelines. */
export function runsRoutes(controller: RunsController): FastifyPluginAsync {
  return async (app) => {
    app.get('/runs', async (request) => controller.list(request));
    app.post('/runs', async (request, reply) => controller.create(request, reply));
    app.get('/runs/:id', async (request) => controller.get(request));
    app.get('/runs/:id/graph', async (request) => controller.graph(request));
    app.post('/runs/:id/cancel', async (request) => controller.cancel(request));
    app.post('/runs/:id/rerun', async (request) => controller.rerun(request));
    app.get('/applications/:key/pipeline', async (request) => controller.pipeline(request));
  };
}
