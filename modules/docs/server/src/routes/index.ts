import type { FastifyPluginAsync } from 'fastify';
import type { DocsControllers } from '../controllers/index.ts';
import { libraryRoutes } from './library.routes.ts';
import { commentsRoutes } from './comments.routes.ts';
import { linksRoutes } from './links.routes.ts';
import { pagesRoutes } from './pages.routes.ts';
import { revisionsRoutes } from './revisions.routes.ts';
import { searchRoutes } from './search.routes.ts';
import { spacesRoutes } from './spaces.routes.ts';
import { treeRoutes } from './tree.routes.ts';

/**
 * Everything under /api/v1/docs, one plugin per area so each area's routes
 * file stays its own and this list is the only shared line to add.
 */
export function docsRoutes(controllers: DocsControllers): FastifyPluginAsync {
  return async (app) => {
    await app.register(spacesRoutes(controllers.spaces));
    await app.register(pagesRoutes(controllers.pages));
    await app.register(treeRoutes(controllers.tree));
    await app.register(libraryRoutes(controllers.library));
    await app.register(searchRoutes(controllers.search));
    await app.register(revisionsRoutes(controllers.revisions));
    await app.register(linksRoutes(controllers.links));
    await app.register(commentsRoutes(controllers.comments));
  };
}
