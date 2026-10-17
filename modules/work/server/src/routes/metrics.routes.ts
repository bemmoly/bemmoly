import type { FastifyPluginAsync } from 'fastify';
import type { MetricsController } from '../controllers/metrics.controller.ts';

/** Velocity, burndown, flow and the Reports screen's series under /api/v1/work. */
export function metricsRoutes(controller: MetricsController): FastifyPluginAsync {
  return async (app) => {
    app.get('/boards/:id/metrics', async (request) => controller.board(request));
    app.get('/sprints/:id/report', async (request) => controller.sprintReport(request));
    app.get('/projects/:key/reports/flow', async (request) => controller.flowReport(request));
  };
}
