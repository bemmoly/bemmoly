import type {
  ActorResolver,
  ApplyModuleDefaultAccess,
  Authorize,
  HousekeepingTask,
  ModuleAccessResolver,
  ModuleDataBackup,
  SessionResolver,
} from '@bemmoly/core';
import { ForbiddenError } from '@bemmoly/shared';

/**
 * What the data kernel needs from identity, authz and backups. Until those
 * services are wired here there is no authenticate (admin routes answer 401,
 * the module list is not filtered by person), no sessions (/ws refuses every
 * upgrade), no module grants, no backup hook (remove data refuses), and only
 * system actors such as `bemmoly-db` pass authorize. At integration:
 *   authenticate        identity's request authenticator (cookie or token)
 *   sessions            createSessionResolver({ db, publicUrl })
 *   moduleAccess        createModuleAccessResolver({ db, modules })
 *   applyDefaultAccess  createApplyModuleDefaultAccess(db)
 *   housekeeping        [{ name: 'sessions', run: (now) => deleteExpiredSessions(db, now) }]
 */
export interface IdentityWiring {
  authenticate?: ActorResolver;
  sessions?: SessionResolver;
  moduleAccess?: ModuleAccessResolver;
  applyDefaultAccess?: ApplyModuleDefaultAccess;
  authorize: Authorize;
  backup?: ModuleDataBackup;
  housekeeping?: readonly HousekeepingTask[];
}

export const systemOnlyAuthorize: Authorize = async (actor) => {
  if (actor.kind !== 'system') throw new ForbiddenError();
};

export function identityWiring(): IdentityWiring {
  return { authorize: systemOnlyAuthorize };
}
