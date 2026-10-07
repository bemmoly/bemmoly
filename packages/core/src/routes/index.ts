import type { FastifyPluginAsync } from 'fastify';
import { createHealthController } from '../controllers/health.controller.ts';
import { createModulesController } from '../controllers/modules.controller.ts';
import type { ModuleRegistry } from '../modules/registry.ts';
import type { DatabaseProbe } from '../services/system/index.ts';
import {
  emailNotificationRoutes,
  type EmailNotificationRouteDependencies,
} from './email-notifications.routes.ts';
import { healthRoutes } from './health.routes.ts';
import { moduleResourceRoutes, modulesRoutes } from './modules.routes.ts';

export const API_PREFIX = '/api/v1';

export interface KernelRouteDependencies {
  modules: ModuleRegistry;
  database?: DatabaseProbe;
  /** Mounted when the host wires email and notifications. */
  emailNotifications?: EmailNotificationRouteDependencies;
}

/** Health probes at the root; kernel and module resources under /api/v1. */
export function kernelRoutes(deps: KernelRouteDependencies): FastifyPluginAsync {
  const health = createHealthController(deps.database ? { database: deps.database } : {});
  const modules = createModulesController(deps.modules);
  return async (app) => {
    await app.register(healthRoutes(health));
    await app.register(
      async (api) => {
        await api.register(modulesRoutes(modules));
        await api.register(moduleResourceRoutes(deps.modules));
        if (deps.emailNotifications) {
          await api.register(emailNotificationRoutes(deps.emailNotifications));
        }
      },
      { prefix: API_PREFIX },
    );
  };
}
