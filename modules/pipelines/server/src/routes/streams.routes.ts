import type { FastifyPluginAsync } from 'fastify';
import type { StreamsController } from '../controllers/streams.controller.ts';

/** Live updates under /api/v1/pipelines/streams (server-sent events). */
export function streamsRoutes(controller: StreamsController): FastifyPluginAsync {
  return async (app) => {
    app.get('/streams', async (request, reply) => controller.open(request, reply));
  };
}
