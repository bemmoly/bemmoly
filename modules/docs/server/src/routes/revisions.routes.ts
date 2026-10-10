import type { FastifyPluginAsync } from 'fastify';
import type { RevisionsController } from '../controllers/revisions.controller.ts';

/** A page's version history, mounted at /api/v1/docs/pages/:pageId/revisions. */
export function revisionsRoutes(controller: RevisionsController): FastifyPluginAsync {
  return async (app) => {
    const base = '/pages/:pageId/revisions';
    app.get(base, async (request) => controller.list(request));
    app.post(base, async (request, reply) => controller.create(request, reply));
    app.get(`${base}/compare`, async (request) => controller.compare(request));
    app.get(`${base}/:revisionId`, async (request) => controller.get(request));
    app.post(`${base}/:revisionId/restore`, async (request) => controller.restore(request));
  };
}
