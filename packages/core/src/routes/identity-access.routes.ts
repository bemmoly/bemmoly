import type { FastifyPluginAsync } from 'fastify';
import { createAppearanceController } from '../controllers/appearance.controller.ts';
import { createAuditController } from '../controllers/audit.controller.ts';
import { createAuthzController } from '../controllers/authz.controller.ts';
import { createIdentityController } from '../controllers/identity.controller.ts';
import { createPeopleController } from '../controllers/people.controller.ts';
import { createWorkspaceLogoController } from '../controllers/workspace-logo.controller.ts';
import type { ObjectStore } from '../contracts/object-store.ts';
import type { IdentityDependencies } from '../services/identity/index.ts';
import { appearanceRoutes } from './appearance.routes.ts';
import { auditRoutes } from './audit.routes.ts';
import { authzRoutes } from './authz.routes.ts';
import { identityRoutes } from './identity.routes.ts';
import { workspaceLogoRoutes } from './workspace-logo.routes.ts';

/** Identity, people, roles, appearance, the workspace logo and the audit log. */
export function identityAndAccessRoutes(
  deps: IdentityDependencies,
  logoStore?: { store: ObjectStore; spoolDir: string },
): FastifyPluginAsync {
  const identity = createIdentityController(deps);
  const people = createPeopleController(deps);
  const authz = createAuthzController(deps);
  const audit = createAuditController(deps.db);
  const appearance = createAppearanceController(deps);
  return async (api) => {
    await api.register(identityRoutes(identity, people));
    await api.register(appearanceRoutes(appearance));
    if (logoStore) {
      await api.register(
        workspaceLogoRoutes(createWorkspaceLogoController({ ...deps, ...logoStore })),
      );
    }
    await api.register(authzRoutes(authz));
    await api.register(auditRoutes(audit));
  };
}
