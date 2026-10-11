import type { FastifyPluginAsync } from 'fastify';
import type { MetricsController } from '../controllers/metrics.controller.ts';

/** Velocity, burndown and flow under /api/v1/work. */
export function metricsRoutes(controller: MetricsController): FastifyPluginAsync {
  return async (app) => {
    app.get('/boards/:id/metrics', async (request) => controller.board(request));
    app.get('/sprints/:id/report', async (request) => controller.sprintReport(request));
  };
}
