import type { FastifyPluginAsync } from 'fastify';
import type { CloudsController } from '../controllers/clouds.controller.ts';

/** Platform › Clouds under /api/v1/pipelines. */
export function cloudsRoutes(controller: CloudsController): FastifyPluginAsync {
  return async (app) => {
    app.get('/clouds/providers', async (request) => controller.providers(request));
    app.get('/clouds', async (request) => controller.list(request));
    app.post('/clouds', async (request, reply) => controller.connect(request, reply));
    app.patch('/clouds/:id', async (request) => controller.update(request));
    app.post('/clouds/:id/check', async (request) => controller.check(request));
    app.post('/clouds/:id/plan', async (request) => controller.plan(request));
    app.post('/clouds/:id/apply', async (request, reply) => controller.apply(request, reply));
    app.get('/clouds/:id/plans/:planId', async (request) => controller.planById(request));
    app.get('/clouds/:id/accounts', async (request) => controller.accounts(request));
    app.post('/clouds/:id/accounts', async (request, reply) => controller.attach(request, reply));
    app.post('/clouds/:id/accounts/:accountId/check', async (request) =>
      controller.recheck(request),
    );
    app.delete('/clouds/:id/accounts/:accountId', async (request, reply) =>
      controller.detach(request, reply),
    );
    app.get('/clouds/:id/resources', async (request) => controller.resources(request));
  };
}
