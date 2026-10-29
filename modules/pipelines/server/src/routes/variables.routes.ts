import type { FastifyPluginAsync } from 'fastify';
import type { VariablesController } from '../controllers/variables.controller.ts';

/** An application's variables and secrets under /api/v1/pipelines. */
export function variablesRoutes(controller: VariablesController): FastifyPluginAsync {
  return async (app) => {
    app.get('/applications/:key/variables', async (request) => controller.list(request));
    app.put('/applications/:key/variables/:name', async (request) => controller.set(request));
    app.delete('/applications/:key/variables/:name', async (request, reply) =>
      controller.remove(request, reply),
    );
  };
}
