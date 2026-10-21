import type { FastifyPluginAsync } from 'fastify';
import type { DashboardsController } from '../controllers/dashboards.controller.ts';

/** Report dashboards and their widgets under /api/v1/work/dashboards. */
export function dashboardsRoutes(controller: DashboardsController): FastifyPluginAsync {
  return async (app) => {
    app.get('/dashboards', async (request) => controller.list(request));
    app.post('/dashboards', async (request, reply) => controller.create(request, reply));
    app.get('/dashboards/:id', async (request) => controller.get(request));
    app.patch('/dashboards/:id', async (request) => controller.update(request));
    app.delete('/dashboards/:id', async (request, reply) => controller.remove(request, reply));
    app.post('/dashboards/:id/widgets', async (request, reply) =>
      controller.addWidget(request, reply),
    );
    app.delete('/dashboards/:id/widgets/:widgetId', async (request, reply) =>
      controller.removeWidget(request, reply),
    );
  };
}
