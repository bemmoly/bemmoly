import type { FastifyPluginAsync } from 'fastify';
import type { AutomationController } from '../controllers/automation.controller.ts';

/** Automation rules, their catalog and their run log under /api/v1/work/automation. */
export function automationRoutes(controller: AutomationController): FastifyPluginAsync {
  return async (app) => {
    app.get('/automation/catalog', async (request) => controller.catalog(request));
    app.get('/automation/rules', async (request) => controller.list(request));
    app.post('/automation/rules', async (request, reply) => controller.create(request, reply));
    app.get('/automation/rules/:id', async (request) => controller.get(request));
    app.patch('/automation/rules/:id', async (request) => controller.update(request));
    app.delete('/automation/rules/:id', async (request, reply) =>
      controller.remove(request, reply),
    );
    app.post('/automation/rules/:id/runs', async (request, reply) =>
      controller.test(request, reply),
    );
    app.get('/automation/runs', async (request) => controller.runs(request));
  };
}
