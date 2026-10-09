import type { FastifyPluginAsync } from 'fastify';
import type { SearchController } from '../controllers/search.controller.ts';

/** GET /api/v1/search: ⌘K asks every module that contributes a search provider. */
export function searchRoutes(controller: SearchController): FastifyPluginAsync {
  return async (app) => {
    app.get('/search', async (request) => controller.search(request));
  };
}
