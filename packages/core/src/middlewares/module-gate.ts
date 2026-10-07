import { ForbiddenError, NotFoundError } from '@bemmoly/shared';
import type { FastifyRequest } from 'fastify';
import type { ModuleAccessResolver } from '../contracts/module-access.ts';
import type { ActorResolver } from './actor.ts';

export interface ModuleGateDeps {
  isEnabled(moduleId: string): boolean;
  /** With both, every module route checks the actor's module access first. */
  access?: ModuleAccessResolver;
  actorOf?: ActorResolver;
}

/**
 * Runs before every route of a module: 404 module_not_enabled while it is
 * disabled (routes stay mounted so enabling needs no restart), then 403
 * module_access_denied when the actor has no grant.
 */
export function moduleGate(moduleId: string, deps: ModuleGateDeps) {
  return async (request: FastifyRequest): Promise<void> => {
    if (!deps.isEnabled(moduleId)) {
      throw new NotFoundError(`The ${moduleId} module is not enabled`, {
        code: 'module_not_enabled',
      });
    }
    if (!deps.access || !deps.actorOf) return;
    const actor = await deps.actorOf(request);
    if (!(await deps.access.canAccess(actor, moduleId))) {
      throw new ForbiddenError(`You do not have access to the ${moduleId} module`, {
        code: 'module_access_denied',
      });
    }
  };
}
