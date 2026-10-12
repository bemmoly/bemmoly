import type { FastifyPluginAsync } from 'fastify';
import type { PairingController } from '../controllers/pairing.controller.ts';

/** The project's pairing matrix, under /api/v1/work. */
export function pairingRoutes(controller: PairingController): FastifyPluginAsync {
  return async (app) => {
    app.get('/projects/:key/pairing', async (request) => controller.matrix(request));
  };
}
