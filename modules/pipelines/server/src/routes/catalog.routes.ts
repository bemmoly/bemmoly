import type { FastifyPluginAsync } from 'fastify';
import type { CatalogController } from '../controllers/catalog.controller.ts';

/** The catalog under /api/v1/pipelines. */
export function catalogRoutes(controller: CatalogController): FastifyPluginAsync {
  return async (app) => {
    app.get('/domains', async (request) => controller.domains(request));
    app.get('/groups', async (request) => controller.groups(request));
    app.get('/applications', async (request) => controller.applications(request));
    app.get('/applications/facets', async (request) => controller.facets(request));
    app.get('/applications/:key', async (request) => controller.application(request));
  };
}
