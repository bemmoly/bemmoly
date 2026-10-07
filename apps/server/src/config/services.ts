import {
  authenticateRequest,
  createUserDirectory,
  isSetupOpen,
  registerSystemJobs,
  wireEmailNotifications,
  type IdentityDependencies,
  type KernelRouteDependencies,
  type ModuleCatalog,
  type ModuleDataBackupHandle,
  type SqlClient,
} from '@bemmoly/core';
import type { Env, Logger } from '@bemmoly/core/config';
import type { DatabaseConnection } from './database.ts';
import { identityRoutes, type IdentityWiring } from './identity.ts';
import type { DataKernel } from './kernel.ts';
import { systemDependencies } from './system.ts';

export interface KernelServicesInput {
  env: Env & { DATABASE_URL: string };
  database: DatabaseConnection;
  kernel: DataKernel;
  identity: IdentityWiring;
  /** Enabled modules, as authorization sees them. */
  modules: ModuleCatalog;
  /** The handle the module admin was built with; bound to the system service here. */
  backup: ModuleDataBackupHandle;
  logger: Logger;
}

export interface KernelServices {
  /** Sign-in, people, roles and audit routes and the authentication middleware. */
  identity: IdentityDependencies & { sql: SqlClient };
  /** Route dependencies the kernel's own routes do not carry. */
  routes: Pick<KernelRouteDependencies, 'emailNotifications' | 'system'>;
}

/**
 * The services built on the data kernel, in order: identity's routes on the
 * kernel's settings, email and notifications on its jobs, realtime and events,
 * then backups, updates and system health, whose jobs join the queue and whose
 * backup now guards remove-data.
 */
export function wireKernelServices(input: KernelServicesInput): KernelServices {
  const { env, database, kernel, identity, logger } = input;
  const people = identityRoutes({
    db: database.db,
    sql: database.sql,
    modules: input.modules,
    events: kernel.events,
    settings: kernel.settings,
    publicUrl: env.BEMMOLY_PUBLIC_URL,
  });
  const mail = wireEmailNotifications({
    env,
    sql: database.sql,
    settings: kernel.settings,
    jobs: kernel.jobs,
    realtime: kernel.realtime,
    events: kernel.events,
    users: createUserDirectory(database.db),
    authorize: identity.authorize,
    authenticate: authenticateRequest,
    logger,
  });
  const system = systemDependencies({
    env,
    sql: database.sql,
    db: database.db,
    logger: logger.child({ component: 'system' }),
    authorize: identity.authorize,
    settings: kernel.settings,
    runner: kernel.runner,
    enabledModules: () => kernel.moduleState.enabledIds(),
    events: kernel.events,
    jobs: kernel.jobs,
    realtime: kernel.realtime,
  });
  input.backup.bind(system);
  registerSystemJobs(kernel.jobs, system);
  return {
    identity: people,
    routes: {
      emailNotifications: mail.routes,
      system: {
        system,
        resolveActor: authenticateRequest,
        setupOpen: () => isSetupOpen(database.db),
      },
    },
  };
}
