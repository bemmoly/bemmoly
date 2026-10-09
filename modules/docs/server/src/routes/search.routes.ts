import type { FastifyPluginAsync } from 'fastify';
import type { SearchController } from '../controllers/search.controller.ts';

/** Page search and the title lookup, under /api/v1/docs/search. */
export function searchRoutes(controller: SearchController): FastifyPluginAsync {
  return async (app) => {
    app.get('/search', async (request) => controller.search(request));
    app.get('/search/suggest', async (request) => controller.suggest(request));
  };
}
