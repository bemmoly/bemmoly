import websocket from '@fastify/websocket';
import type { FastifyPluginAsync } from 'fastify';
import type { RealtimeController } from '../controllers/realtime.controller.ts';

/** The WebSocket hub for invalidations. Authenticates on upgrade. */
export function realtimeRoutes(controller: RealtimeController): FastifyPluginAsync {
  return async (app) => {
    await app.register(websocket, { options: { maxPayload: 16 * 1024 } });
    app.get(
      '/ws',
      { websocket: true, preValidation: (request) => controller.authenticate(request) },
      (socket, request) => controller.connect(socket, request),
    );
  };
}
