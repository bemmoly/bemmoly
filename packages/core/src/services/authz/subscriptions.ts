import type { Database } from '../../clients/drizzle.ts';
import type { Actor } from '../../contracts/authz.ts';
import type { SubscriptionAuthorizer } from '../realtime/index.ts';
import { loadMembershipRole, loadPrincipal, type ContainerKind } from './loaders.ts';

/** What the check reads; the database supplies these, tests their own. */
export interface SubscriptionLookups {
  /** Null when the person does not exist or is not active. */
  principal(userId: string): Promise<{ isOrgAdmin: boolean } | null>;
  isMember(kind: ContainerKind, containerId: string, userId: string): Promise<boolean>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const personOf = (actor: Actor): string | undefined =>
  actor.kind === 'user' ? actor.id : actor.userId;

/**
 * Who may listen to a scope over /ws, for invalidations and presence alike: the same people
 * who can open it. A project or space takes an org admin or a member, as its lists do; the
 * workspace and a module take any active person (the hub checks module access itself).
 */
export function subscriptionAuthorizer(lookups: SubscriptionLookups): SubscriptionAuthorizer {
  return async (actor, scope) => {
    if (actor.kind === 'system') return true;
    const userId = personOf(actor);
    if (!userId) return false;
    const principal = await lookups.principal(userId);
    if (!principal) return false;
    if (scope.kind === 'workspace' || scope.kind === 'module') return true;
    if (principal.isOrgAdmin) return true;
    // Container ids are UUIDs; anything else names nothing, and must not reach the query.
    if (!UUID.test(scope.id)) return false;
    return lookups.isMember(scope.kind, scope.id, userId);
  };
}

/** The authorizer over the identity tables, for the WebSocket hub. */
export function createSubscriptionAuthorizer(db: Database): SubscriptionAuthorizer {
  return subscriptionAuthorizer({
    principal: (userId) => loadPrincipal(db, userId),
    isMember: async (kind, containerId, userId) =>
      (await loadMembershipRole(db, kind, containerId, userId)) !== null,
  });
}
