import type { FastifyPluginAsync } from 'fastify';
import type { TypesController } from '../controllers/types.controller.ts';

/** Org defaults at /issue-types and a project's scheme at /projects/:key/issue-types. */
export function typesRoutes(controller: TypesController): FastifyPluginAsync {
  return async (app) => {
    for (const base of ['/issue-types', '/projects/:key/issue-types']) {
      app.get(base, async (request) => controller.list(request));
      app.post(base, async (request, reply) => controller.create(request, reply));
      app.post(`${base}/reorder`, async (request) => controller.reorder(request));
      app.patch(`${base}/:id`, async (request) => controller.update(request));
      app.delete(`${base}/:id`, async (request, reply) => controller.remove(request, reply));
      app.get(`${base}/:id/fields`, async (request) => controller.layout(request));
      app.put(`${base}/:id/fields`, async (request) => controller.putLayout(request));
    }
  };
}
