import type { CapabilityName, ModuleId } from '@bemmoly/shared';

export type ActorKind = 'user' | 'api_token' | 'ai_plan' | 'system' | 'automation';

export interface Actor {
  kind: ActorKind;
  id: string;
  /** The person a token, an AI plan or a rule acts for; absent for system jobs. */
  userId?: string;
  /**
   * An automation actor's rule ids that led to this one, oldest first, so a rule's own
   * actions never trigger it again and a chain of rules stops at a fixed depth.
   */
  chain?: readonly string[];
}

export interface ResourceRef {
  kind: 'workspace' | 'module' | 'project' | 'space' | (string & {});
  id?: string;
  /** The module that owns the resource; module access is checked before capability. */
  moduleId?: ModuleId;
}

/**
 * Resolves module access, container membership and capability, in that order.
 * Throws ForbiddenError with code `module_access_denied` or `forbidden`.
 */
export type Authorize = (
  actor: Actor,
  capability: CapabilityName,
  resource: ResourceRef,
) => Promise<void>;

export interface AuthorizationService {
  authorize: Authorize;
  can(actor: Actor, capability: CapabilityName, resource: ResourceRef): Promise<boolean>;
}
