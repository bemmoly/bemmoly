import type { FastifyPluginAsync } from 'fastify';
import type { OrganisationController } from '../controllers/environments.controller.ts';

/** Environments, paths, teams and the overview under /api/v1/pipelines. */
export function organisationRoutes(controller: OrganisationController): FastifyPluginAsync {
  return async (app) => {
    app.get('/environments', async (request) => controller.environments(request));
    app.get('/environments/paths', async (request) => controller.paths(request));
    app.get('/teams', async (request) => controller.teams(request));
    app.get('/overview', async (request) => controller.overview(request));
  };
}
