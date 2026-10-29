import type { FastifyPluginAsync } from 'fastify';
import type { FrontDoorsController } from '../controllers/front-doors.controller.ts';

/** Front doors and runtime moves under /api/v1/pipelines. */
export function frontDoorsRoutes(controller: FrontDoorsController): FastifyPluginAsync {
  return async (app) => {
    app.get('/front-doors', async (request) => controller.list(request));
    app.put('/environments/:key/front-door', async (request) => controller.set(request));
    app.get('/runtime-moves', async (request) => controller.moves(request));
    app.get('/runtime-moves/:id', async (request) => controller.move(request));
    app.post('/runtime-moves/:id/start', async (request) => controller.start(request));
    app.post('/runtime-moves/:id/pause', async (request) => controller.pause(request));
    app.post('/runtime-moves/:id/continue', async (request) => controller.resume(request));
    app.post('/runtime-moves/:id/rollback', async (request) => controller.rollback(request));
  };
}
