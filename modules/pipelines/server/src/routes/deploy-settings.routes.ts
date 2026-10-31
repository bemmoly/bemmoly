import type { FastifyPluginAsync } from 'fastify';
import type { DeploySettingsController } from '../controllers/deploy-settings.controller.ts';

/** Deploy settings under /api/v1/pipelines. */
export function deploySettingsRoutes(controller: DeploySettingsController): FastifyPluginAsync {
  return async (app) => {
    app.get('/applications/:key/settings', async (request) => controller.list(request));
    app.put('/applications/:key/settings/:environment', async (request) => controller.set(request));
    app.delete('/applications/:key/settings/:environment', async (request, reply) =>
      controller.clear(request, reply),
    );
    app.get('/environments/:key/runtimes', async (request) =>
      controller.environmentRuntimes(request),
    );
  };
}
