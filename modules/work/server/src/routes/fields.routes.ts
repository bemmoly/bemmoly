import type { FastifyPluginAsync } from 'fastify';
import type { FieldsController } from '../controllers/fields.controller.ts';

/** Org default fields at /fields and a project's copies at /projects/:key/fields. */
export function fieldsRoutes(controller: FieldsController): FastifyPluginAsync {
  return async (app) => {
    for (const base of ['/fields', '/projects/:key/fields']) {
      app.get(base, async (request) => controller.list(request));
      app.post(base, async (request, reply) => controller.create(request, reply));
      app.patch(`${base}/:id`, async (request) => controller.update(request));
      app.delete(`${base}/:id`, async (request, reply) => controller.remove(request, reply));
    }
  };
}
