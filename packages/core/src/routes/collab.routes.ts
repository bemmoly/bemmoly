import type { FastifyPluginAsync } from 'fastify';
import type { CollabController } from '../controllers/collab.controller.ts';

/**
 * The Yjs endpoint for collaborative documents (Hocuspocus protocol). Authenticates on
 * upgrade with the session cookie; one socket carries every document a tab has open.
 */
export function collabRoutes(controller: CollabController): FastifyPluginAsync {
  return async (app) => {
    app.get(
      '/collab',
      { websocket: true, preValidation: (request) => controller.authenticate(request) },
      (socket, request) => controller.connect(socket, request),
    );
  };
}
