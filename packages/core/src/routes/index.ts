import type { FastifyPluginAsync } from 'fastify';
import { createHealthController } from '../controllers/health.controller.ts';
import {
  createModuleAdminController,
  createModulesController,
} from '../controllers/modules.controller.ts';
import { createRealtimeController } from '../controllers/realtime.controller.ts';
import { createSettingsController } from '../controllers/settings.controller.ts';
import type { ModuleAccessResolver } from '../contracts/module-access.ts';
import type { SessionResolver } from '../contracts/session-resolver.ts';
import { createActorResolver, type ActorResolver } from '../middlewares/actor.ts';
import type { ModuleRegistry } from '../modules/registry.ts';
import type { ModuleAdmin, ModuleState } from '../services/modules/index.ts';
import type { RealtimeHub, RealtimeMetricsHook } from '../services/realtime/index.ts';
import type { SettingsAdmin } from '../services/settings/index.ts';
import type { DatabaseProbe } from '../services/system/index.ts';
import { healthRoutes } from './health.routes.ts';
import { adminModulesRoutes, moduleResourceRoutes, modulesRoutes } from './modules.routes.ts';
import { realtimeRoutes } from './realtime.routes.ts';
import { adminSettingsRoutes } from './settings.routes.ts';

export const API_PREFIX = '/api/v1';

export interface KernelRouteDependencies {
  /** Every module in the image, registered. */
  modules: ModuleRegistry;
  database?: DatabaseProbe;
  /**
   * Resolves the actor of an HTTP request (session cookie or API token), or
   * rejects with 401. Without it (and without `sessions`), admin routes answer
   * 401 and the module list is not filtered by person.
   */
  authenticate?: ActorResolver;
  /** Session cookies and origin checks for the /ws upgrade. */
  sessions?: SessionResolver;
  moduleAccess?: ModuleAccessResolver;
  /** Live enabled state; without it every registered module counts as enabled. */
  moduleState?: ModuleState;
  moduleAdmin?: ModuleAdmin;
  settings?: SettingsAdmin;
  /** The WebSocket hub; /ws is mounted only when present. */
  realtime?: RealtimeHub;
  /** The observability service's `getMetrics().realtime`. */
  realtimeMetrics?: RealtimeMetricsHook;
}

/** Health probes at the root, /ws, and kernel and module resources under /api/v1. */
export function kernelRoutes(deps: KernelRouteDependencies): FastifyPluginAsync {
  const health = createHealthController(deps.database ? { database: deps.database } : {});
  const actorOf = deps.authenticate ?? createActorResolver(deps.sessions);
  const identified = Boolean(deps.authenticate ?? deps.sessions);
  const state = deps.moduleState;
  const modules = createModulesController({
    registry: deps.modules,
    ...(state ? { state } : {}),
    ...(deps.moduleAccess ? { access: deps.moduleAccess } : {}),
    ...(identified ? { actorOf } : {}),
  });
  const gate = {
    isEnabled: (id: string) => (state ? state.isEnabled(id) : deps.modules.has(id)),
    ...(deps.moduleAccess && identified ? { access: deps.moduleAccess, actorOf } : {}),
  };
  return async (app) => {
    await app.register(healthRoutes(health));
    if (deps.realtime) {
      await app.register(
        realtimeRoutes(
          createRealtimeController({
            hub: deps.realtime,
            ...(deps.sessions ? { sessions: deps.sessions } : {}),
            ...(deps.realtimeMetrics ? { metrics: deps.realtimeMetrics } : {}),
          }),
        ),
      );
    }
    await app.register(
      async (api) => {
        await api.register(modulesRoutes(modules));
        if (deps.moduleAdmin) {
          await api.register(
            adminModulesRoutes(createModuleAdminController(deps.moduleAdmin, actorOf)),
          );
        }
        if (deps.settings) {
          await api.register(adminSettingsRoutes(createSettingsController(deps.settings, actorOf)));
        }
        await api.register(moduleResourceRoutes(deps.modules, gate));
      },
      { prefix: API_PREFIX },
    );
  };
}
