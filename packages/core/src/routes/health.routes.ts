import type { FastifyPluginAsync } from 'fastify';
import type { HealthController } from '../controllers/health.controller.ts';

/** Anonymous by design: liveness and readiness probes. */
export function healthRoutes(controller: HealthController): FastifyPluginAsync {
  return async (app) => {
    app.get('/healthz', async () => controller.liveness());
    app.get('/readyz', async (_request, reply) => controller.readiness(reply));
  };
}
