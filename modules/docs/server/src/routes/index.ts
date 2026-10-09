import type { FastifyPluginAsync } from 'fastify';
import type { DocsControllers } from '../controllers/index.ts';
import { pagesRoutes } from './pages.routes.ts';
import { spacesRoutes } from './spaces.routes.ts';

/**
 * Everything under /api/v1/docs, one plugin per area so each area's routes
 * file stays its own and this list is the only shared line to add.
 */
export function docsRoutes(controllers: DocsControllers): FastifyPluginAsync {
  return async (app) => {
    await app.register(spacesRoutes(controllers.spaces));
    await app.register(pagesRoutes(controllers.pages));
  };
}
