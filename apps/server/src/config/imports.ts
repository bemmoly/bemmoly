import { createSecretBox, wireImports, type Imports, type ModuleRegistry } from '@bemmoly/core';
import type { Env, Logger } from '@bemmoly/core/config';
import type { DatabaseConnection } from './database.ts';
import type { IdentityWiring } from './identity.ts';
import type { DataKernel } from './kernel.ts';

export interface ImportsWiringInput {
  env: Pick<Env, 'BEMMOLY_SECRET_KEY' | 'BEMMOLY_ALLOW_PRIVATE_URLS'>;
  database: DatabaseConnection;
  kernel: DataKernel;
  identity: IdentityWiring;
  /** Every registered module; only the enabled ones' importers are offered. */
  modules: ModuleRegistry;
  logger: Logger;
}

/** Settings › Import and the import.run job, registered before the jobs service starts. */
export function wireImporters(input: ImportsWiringInput): Imports {
  const { env, database, kernel } = input;
  return wireImports({
    sql: database.sql,
    modules: input.modules,
    isEnabled: (moduleId) => kernel.moduleState.isEnabled(moduleId),
    jobs: kernel.jobs,
    objectStore: kernel.objectStore,
    secrets: createSecretBox(env.BEMMOLY_SECRET_KEY),
    authorize: input.identity.authorize,
    allowPrivateUrls: env.BEMMOLY_ALLOW_PRIVATE_URLS,
    logger: input.logger.child({ component: 'import' }),
    events: kernel.events,
  });
}
