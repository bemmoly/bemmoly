import type { FastifyPluginAsync } from 'fastify';
import type { LabelsController } from '../controllers/labels.controller.ts';

/** A project's labels under /api/v1/work/projects/:key/labels. */
export function labelsRoutes(controller: LabelsController): FastifyPluginAsync {
  return async (app) => {
    app.get('/projects/:key/labels', async (request) => controller.list(request));
    app.post('/projects/:key/labels', async (request, reply) => controller.create(request, reply));
    app.patch('/projects/:key/labels/:id', async (request) => controller.update(request));
    app.delete('/projects/:key/labels/:id', async (request, reply) =>
      controller.remove(request, reply),
    );
  };
}
