import type { FastifyPluginAsync } from 'fastify';
import type { LinksController } from '../controllers/links.controller.ts';

/** The links graph: a page's edges both ways, and the pages that point at any record. */
export function linksRoutes(controller: LinksController): FastifyPluginAsync {
  return async (app) => {
    app.get('/pages/:pageId/links', async (request) => controller.outgoing(request));
    app.put('/pages/:pageId/links', async (request) => controller.setLinked(request));
    app.get('/pages/:pageId/backlinks', async (request) => controller.backlinks(request));
    app.get('/pages/:pageId/references', async (request) => controller.references(request));
    app.get('/references', async (request) => controller.linkedDocs(request));
  };
}
