import type { CapabilityName } from '@bemmoly/shared';
import type { Actor, AuthorizationService, ResourceRef } from '../../contracts/authz.ts';
import type { ModuleAccessResolver } from '../../contracts/module-access.ts';
import type { SqlExecutor } from '../../contracts/sql.ts';

/**
 * Who is acting and how to check them, built once per request by the auth
 * middleware. The authz object caches the resolved capability and module sets
 * for the life of the request.
 */
export interface RequestContext {
  actor: Actor;
  authz: RequestAuthorization;
  ip?: string;
  requestId?: string;
}

export interface RequestAuthorization extends AuthorizationService, ModuleAccessResolver {
  /** Workspace-level capabilities the actor holds, for /me and the web shell. */
  workspaceCapabilities(actor: Actor): Promise<string[]>;
  /** True when the actor's org role is Org admin. */
  isOrgAdmin(actor: Actor): Promise<boolean>;
  /**
   * The people among `userIds` who hold the capability on the resource, in input order:
   * one pass for fan-out (notification recipients, mentions) instead of one check each.
   */
  whoCan(
    userIds: readonly string[],
    capability: CapabilityName,
    resource: ResourceRef,
  ): Promise<string[]>;
  /**
   * The same checks with every lookup on `transaction`, sharing this request's caches. Code
   * inside a transaction must use it: asking the pool there holds one connection while
   * waiting for another, and enough of those at once starve the pool for good.
   */
  within(transaction: SqlExecutor): RequestAuthorization;
}

/**
 * The request as code inside a transaction must see it: every authorization lookup runs on
 * the transaction, never on the pool. Hand this to anything called from inside `begin`.
 */
export function scopeToTransaction(ctx: RequestContext, transaction: SqlExecutor): RequestContext {
  return { ...ctx, authz: ctx.authz.within(transaction) };
}
