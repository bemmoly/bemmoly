import type { FastifyPluginAsync } from 'fastify';
import type { WorkControllers } from '../controllers/index.ts';
import { projectsRoutes } from './projects.routes.ts';

/**
 * Everything under /api/v1/work, one plugin per area so each area's routes
 * file stays its own and this list is the only shared line to add.
 */
export function workRoutes(controllers: WorkControllers): FastifyPluginAsync {
  return async (app) => {
    await app.register(projectsRoutes(controllers.projects));
  };
}
