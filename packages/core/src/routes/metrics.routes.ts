import type { FastifyPluginAsync } from 'fastify';
import type { MetricsController } from '../controllers/metrics.controller.ts';

/**
 * Prometheus scrape at the root, by convention. Not a session endpoint: it is
 * authenticated by the BEMMOLY_METRICS_TOKEN bearer token, and absent when that is unset.
 */
export function metricsRoutes(controller: MetricsController): FastifyPluginAsync {
  return async (app) => {
    app.get('/metrics', async (request, reply) => controller.scrape(request, reply));
  };
}
