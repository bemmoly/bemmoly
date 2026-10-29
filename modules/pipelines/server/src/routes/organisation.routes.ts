import type { FastifyPluginAsync } from 'fastify';
import type { OrganisationController } from '../controllers/environments.controller.ts';

/** Environments, paths, teams and the overview under /api/v1/pipelines. */
export function organisationRoutes(controller: OrganisationController): FastifyPluginAsync {
  return async (app) => {
    app.get('/environments', async (request) => controller.environments(request));
    app.post('/environments', async (request, reply) => controller.create(request, reply));
    app.get('/environments/paths', async (request) => controller.paths(request));
    app.put('/environments/paths/:tier', async (request) => controller.setPath(request));
    app.patch('/environments/:key', async (request) => controller.update(request));
    app.delete('/environments/:key', async (request, reply) => controller.archive(request, reply));
    app.get('/teams', async (request) => controller.teams(request));
    app.get('/overview', async (request) => controller.overview(request));
  };
}
