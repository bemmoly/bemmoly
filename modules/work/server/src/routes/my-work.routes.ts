import type { FastifyPluginAsync } from 'fastify';
import type { MyWorkController } from '../controllers/my-work.controller.ts';

/** GET /api/v1/work/my-issues: the signed-in person's lists for Home. */
export function myWorkRoutes(controller: MyWorkController): FastifyPluginAsync {
  return async (app) => {
    app.get('/my-issues', async (request) => controller.list(request));
  };
}
