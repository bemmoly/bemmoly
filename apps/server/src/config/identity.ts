import {
  authenticateRequest,
  createAuthorize,
  createIdentityDependencies,
  createModuleAccessResolver,
  createModuleAccessWriter,
  createSessionResolver,
  deleteExpiredSessions,
  type ActorResolver,
  type Authorize,
  type Database,
  type EventBus,
  type HousekeepingTask,
  type IdentityDependencies,
  type ModuleAccessResolver,
  type ModuleAccessWriter,
  type ModuleCatalog,
  type ModuleDataBackup,
  type SessionResolver,
  type SettingsService,
  type SqlClient,
} from '@bemmoly/core';
import { ForbiddenError } from '@bemmoly/shared';

/**
 * What the data kernel needs from identity, authz and backups. Without a
 * database there is no authenticate (admin routes answer 401), no sessions
 * (/ws refuses every upgrade), no module grants, and only system actors such
 * as `bemmoly-db` pass authorize.
 */
export interface IdentityWiring {
  authenticate?: ActorResolver;
  sessions?: SessionResolver;
  moduleAccess?: ModuleAccessResolver;
  moduleAccessWriter?: ModuleAccessWriter;
  authorize: Authorize;
  backup?: ModuleDataBackup;
  housekeeping?: readonly HousekeepingTask[];
}

export const systemOnlyAuthorize: Authorize = async (actor) => {
  if (actor.kind !== 'system') throw new ForbiddenError();
};

export interface IdentityWiringInput {
  db: Database;
  /** Enabled modules; bound to the module state once the kernel creates it. */
  modules: ModuleCatalog;
  publicUrl: string;
  /** Takes a verified backup before remove-data; bound once the system service exists. */
  backup?: ModuleDataBackup;
}

/** The identity hooks the kernel calls; built before the kernel, from the database alone. */
export function identityWiring(input?: IdentityWiringInput): IdentityWiring {
  if (!input) return { authorize: systemOnlyAuthorize };
  const { db, modules, publicUrl } = input;
  return {
    authenticate: authenticateRequest,
    sessions: createSessionResolver({ db, publicUrl }),
    moduleAccess: createModuleAccessResolver({ db, modules }),
    moduleAccessWriter: createModuleAccessWriter(db),
    authorize: createAuthorize({ db, modules }),
    ...(input.backup ? { backup: input.backup } : {}),
    housekeeping: [{ name: 'sessions', run: (now) => deleteExpiredSessions(db, now) }],
  };
}

export interface IdentityRoutesInput extends IdentityWiringInput {
  sql: SqlClient;
  events: EventBus;
  /** The kernel's database-backed settings (workspace.name, workspace.url). */
  settings: SettingsService;
}

/** Sign-in, people, roles and audit; built after the kernel so they use its settings. */
export function identityRoutes(input: IdentityRoutesInput): IdentityDependencies & {
  sql: SqlClient;
} {
  return createIdentityDependencies(input);
}
