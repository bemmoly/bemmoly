import type { FastifyPluginAsync } from 'fastify';
import { createAuditController } from '../controllers/audit.controller.ts';
import { createAuthzController } from '../controllers/authz.controller.ts';
import { createHealthController } from '../controllers/health.controller.ts';
import { createIdentityController } from '../controllers/identity.controller.ts';
import { createModulesController } from '../controllers/modules.controller.ts';
import { createPeopleController } from '../controllers/people.controller.ts';
import type { ModuleRegistry } from '../modules/registry.ts';
import type { IdentityDependencies } from '../services/identity/index.ts';
import type { DatabaseProbe } from '../services/system/index.ts';
import { auditRoutes } from './audit.routes.ts';
import { authzRoutes } from './authz.routes.ts';
import { healthRoutes } from './health.routes.ts';
import { identityRoutes } from './identity.routes.ts';
import { moduleResourceRoutes, modulesRoutes } from './modules.routes.ts';

export const API_PREFIX = '/api/v1';

export interface KernelRouteDependencies {
  modules: ModuleRegistry;
  database?: DatabaseProbe;
  /** Identity, authorization and audit routes; mounted only when a database is configured. */
  identity?: IdentityDependencies;
}

function identityAndAccessRoutes(deps: IdentityDependencies): FastifyPluginAsync {
  const identity = createIdentityController(deps);
  const people = createPeopleController(deps);
  const authz = createAuthzController(deps);
  const audit = createAuditController(deps.db);
  return async (api) => {
    await api.register(identityRoutes(identity, people));
    await api.register(authzRoutes(authz));
    await api.register(auditRoutes(audit));
  };
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
        if (deps.identity) await api.register(identityAndAccessRoutes(deps.identity));
        await api.register(moduleResourceRoutes(deps.modules));
      },
      { prefix: API_PREFIX },
    );
  };
}
