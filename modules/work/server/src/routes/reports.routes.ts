import type { FastifyPluginAsync } from 'fastify';
import type { ReportsController } from '../controllers/reports.controller.ts';

/** The control chart, time in status and epic and version burnups, under /api/v1/work. */
export function reportsRoutes(controller: ReportsController): FastifyPluginAsync {
  return async (app) => {
    app.get('/projects/:key/reports/control', async (request) => controller.control(request));
    app.get('/projects/:key/reports/time-in-status', async (request) =>
      controller.timeInStatus(request),
    );
    app.get('/projects/:key/reports/scope', async (request) => controller.scope(request));
  };
}
