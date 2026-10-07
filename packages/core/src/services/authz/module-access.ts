import { eq } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import type { Actor, Authorize } from '../../contracts/authz.ts';
import type {
  ApplyModuleDefaultAccess,
  ModuleAccessResolver,
} from '../../contracts/module-access.ts';
import { moduleGrants } from '../../models/identity/index.ts';
import { recordAudit } from '../audit/index.ts';
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

/**
 * Gives a newly enabled module its declared starting access. `everyone` adds an
 * everyone grant; `teams` and `none` add nothing, so only org admins see the
 * module until an admin grants teams. Runs only while the module has no grants,
 * so re-enabling never undoes an admin's choices.
 */
export function createApplyModuleDefaultAccess(db: Database): ApplyModuleDefaultAccess {
  return async (module, actor) => {
    if (module.defaultAccess !== 'everyone') return;
    await db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: moduleGrants.id })
        .from(moduleGrants)
        .where(eq(moduleGrants.moduleId, module.id))
        .limit(1);
      if (existing.length > 0) return;
      const [grant] = await tx
        .insert(moduleGrants)
        .values({
          moduleId: module.id,
          subjectKind: 'everyone',
          grantedBy: actor.kind === 'user' ? actor.id : (actor.userId ?? null),
        })
        .returning();
      await recordAudit(tx, {
        actor,
        action: 'module_grant.created',
        target: { kind: 'module_grant', id: grant?.id ?? null },
        after: { moduleId: module.id, subjectKind: 'everyone', reason: 'default_access' },
      });
    });
  };
}
