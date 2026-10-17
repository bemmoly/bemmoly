import type { FastifyPluginAsync } from 'fastify';
import type { JobsController } from '../controllers/jobs.controller.ts';

/** Job logs and artifacts, an application's tests and failure groups, under /api/v1/pipelines. */
export function jobsRoutes(controller: JobsController): FastifyPluginAsync {
  return async (app) => {
    app.get('/jobs/:id/logs', async (request) => controller.logs(request));
    app.get('/jobs/:id/logs/search', async (request) => controller.search(request));
    app.get('/jobs/:id/artifacts', async (request) => controller.artifacts(request));
    app.get('/jobs/:id/artifacts/:name', async (request, reply) =>
      controller.download(request, reply),
    );
    app.get('/applications/:key/tests', async (request) => controller.tests(request));
    app.post('/applications/:key/tests/quarantines', async (request, reply) =>
      controller.quarantine(request, reply),
    );
    app.delete('/applications/:key/tests/quarantines/:id', async (request, reply) =>
      controller.release(request, reply),
    );
    app.get('/failures', async (request) => controller.failures(request));
  };
}
