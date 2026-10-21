import type { FastifyPluginAsync } from 'fastify';
import type { AskReportsController } from '../controllers/ask-reports.controller.ts';

/**
 * Asked and pinned reports under /api/v1/work. `ask` and `run` are verbs on a project's
 * reports with no noun of their own: one turns a question into a report through AI, the
 * other builds a report from a spec without it.
 */
export function askReportsRoutes(controller: AskReportsController): FastifyPluginAsync {
  return async (app) => {
    app.post('/projects/:key/reports/ask', async (request) => controller.ask(request));
    app.post('/projects/:key/reports/run', async (request) => controller.run(request));
    app.get('/projects/:key/pinned-reports', async (request) => controller.listPinned(request));
    app.post('/projects/:key/pinned-reports', async (request, reply) =>
      controller.pin(request, reply),
    );
    app.delete('/pinned-reports/:id', async (request, reply) => controller.unpin(request, reply));
  };
}
