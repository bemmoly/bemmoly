import type { Actor, AuthorizationService } from '../../contracts/authz.ts';
import type { ModuleAccessResolver } from '../../contracts/module-access.ts';

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
}
