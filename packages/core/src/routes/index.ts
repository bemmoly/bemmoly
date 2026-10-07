import type { FastifyPluginAsync } from 'fastify';
import { createHealthController } from '../controllers/health.controller.ts';
import { createMetricsController } from '../controllers/metrics.controller.ts';
import { createModulesController } from '../controllers/modules.controller.ts';
import type { ModuleRegistry } from '../modules/registry.ts';
import type { DatabaseProbe } from '../services/system/index.ts';
import type { ScrapeDependencies } from '../services/telemetry/index.ts';
import { healthRoutes } from './health.routes.ts';
import { metricsRoutes } from './metrics.routes.ts';
import { moduleResourceRoutes, modulesRoutes } from './modules.routes.ts';

export const API_PREFIX = '/api/v1';

export interface KernelRouteDependencies {
  modules: ModuleRegistry;
  database?: DatabaseProbe;
  /** Serves /metrics when given; the route answers 404 until a token is configured. */
  metrics?: ScrapeDependencies;
}

/** Health probes and /metrics at the root; kernel and module resources under /api/v1. */
export function kernelRoutes(deps: KernelRouteDependencies): FastifyPluginAsync {
  const health = createHealthController(deps.database ? { database: deps.database } : {});
  const modules = createModulesController(deps.modules);
  const metrics = deps.metrics ? createMetricsController(deps.metrics) : undefined;
  return async (app) => {
    await app.register(healthRoutes(health));
    if (metrics) await app.register(metricsRoutes(metrics));
    await app.register(
      async (api) => {
        await api.register(modulesRoutes(modules));
        await api.register(moduleResourceRoutes(deps.modules));
      },
      { prefix: API_PREFIX },
    );
  };
}
