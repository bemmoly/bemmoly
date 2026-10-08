import type { Actor, Authorize } from '../../contracts/authz.ts';
import type { ModuleAccessResolver } from '../../contracts/module-access.ts';
import { createRequestAuthorization, type AuthzDependencies } from './authorize.ts';

/**
 * A resolver for callers outside a request (the WebSocket hub, jobs). Each call
 * resolves fresh; inside a request use the request's authz, which caches.
 */
export function createModuleAccessResolver(deps: AuthzDependencies): ModuleAccessResolver {
  return {
    modulesFor: (actor: Actor) => createRequestAuthorization(deps).modulesFor(actor),
    canAccess: (actor: Actor, moduleId: string) =>
      createRequestAuthorization(deps).canAccess(actor, moduleId),
  };
}

/**
 * authorize() for callers outside a request (module and settings admin, the
 * CLI). Each call resolves fresh; inside a request use the request's authz.
 */
export function createAuthorize(deps: AuthzDependencies): Authorize {
  return (actor, capability, resource) =>
    createRequestAuthorization(deps).authorize(actor, capability, resource);
}
