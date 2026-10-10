import type { FastifyPluginAsync } from 'fastify';
import type { RealtimeController } from '../controllers/realtime.controller.ts';

/** The WebSocket hub for invalidations. Authenticates on upgrade; kernelRoutes registers the plugin. */
export function realtimeRoutes(controller: RealtimeController): FastifyPluginAsync {
  return async (app) => {
    app.get(
      '/ws',
      { websocket: true, preValidation: (request) => controller.authenticate(request) },
      (socket, request) => controller.connect(socket, request),
    );
  };
}
