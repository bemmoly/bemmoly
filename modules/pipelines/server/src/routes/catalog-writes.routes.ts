import type { FastifyPluginAsync } from 'fastify';
import type { CatalogWritesController } from '../controllers/catalog-writes.controller.ts';

/** Catalog writes under /api/v1/pipelines. */
export function catalogWritesRoutes(controller: CatalogWritesController): FastifyPluginAsync {
  return async (app) => {
    app.post('/domains', async (request, reply) => controller.createDomain(request, reply));
    app.patch('/domains/:key', async (request) => controller.updateDomain(request));
    app.delete('/domains/:key', async (request, reply) => controller.removeDomain(request, reply));
    app.post('/groups', async (request, reply) => controller.createGroup(request, reply));
    app.patch('/groups/:id', async (request) => controller.updateGroup(request));
    app.delete('/groups/:id', async (request, reply) => controller.removeGroup(request, reply));
    app.post('/applications', async (request, reply) =>
      controller.createApplication(request, reply),
    );
    app.patch('/applications/:key', async (request) => controller.updateApplication(request));
    app.put('/applications/:key/dependencies', async (request) =>
      controller.setDependencies(request),
    );
    app.delete('/applications/:key', async (request, reply) =>
      controller.removeApplication(request, reply),
    );
    app.get('/catalog-changes', async (request) => controller.changes(request));
  };
}
