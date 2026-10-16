import type { FastifyPluginAsync } from 'fastify';
import type { TimeTrackingController } from '../controllers/time-tracking.controller.ts';

/** The time tracking report, under /api/v1/work. */
export function timeTrackingRoutes(controller: TimeTrackingController): FastifyPluginAsync {
  return async (app) => {
    app.get('/projects/:key/reports/time-tracking', async (request) => controller.report(request));
  };
}
