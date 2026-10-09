import type { FastifyPluginAsync } from 'fastify';
import type { ProjectsController } from '../controllers/projects.controller.ts';

/** Mounted at /api/v1/work/projects behind the kernel's module gate. */
export function projectsRoutes(controller: ProjectsController): FastifyPluginAsync {
  return async (app) => {
    app.get('/projects', async (request) => controller.list(request));
    app.post('/projects', async (request, reply) => controller.create(request, reply));
    app.get('/projects/:key', async (request) => controller.get(request));
    app.get('/projects/by-key/:key', async (request) => controller.get(request));
    app.patch('/projects/:key', async (request) => controller.update(request));
    app.delete('/projects/:key', async (request, reply) => controller.remove(request, reply));
    app.post('/projects/:key/archive', async (request) => controller.archive(request));
    app.post('/projects/:key/unarchive', async (request) => controller.unarchive(request));
  };
}
