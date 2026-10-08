import type { FastifyPluginAsync } from 'fastify';
import type { ProjectsController } from '../controllers/projects.controller.ts';

/** Mounted at /api/v1/work/projects behind the kernel's module gate. */
export function projectsRoutes(controller: ProjectsController): FastifyPluginAsync {
  return async (app) => {
    app.get('/projects', async (request) => controller.list(request));
  };
}
