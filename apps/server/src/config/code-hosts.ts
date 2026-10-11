import {
  createSecretBox,
  wireCodeHosts,
  type CodeHosts,
  type ModuleCatalog,
  type ModuleRegistry,
} from '@bemmoly/core';
import type { Env, Logger } from '@bemmoly/core/config';
import type { DatabaseConnection } from './database.ts';
import type { IdentityWiring } from './identity.ts';
import type { DataKernel } from './kernel.ts';

export interface CodeHostsWiringInput {
  env: Pick<Env, 'BEMMOLY_SECRET_KEY' | 'BEMMOLY_ALLOW_PRIVATE_URLS' | 'BEMMOLY_PUBLIC_URL'>;
  database: DatabaseConnection;
  kernel: DataKernel;
  identity: IdentityWiring;
  /** Every registered module; only the enabled ones' consumers hear deliveries. */
  modules: ModuleRegistry;
  catalog: ModuleCatalog;
  logger: Logger;
}

/** Settings › Integrations › Code hosts, the webhooks and the backfill job, before jobs start. */
export function wireCodeHostIntegrations(input: CodeHostsWiringInput): CodeHosts {
  const { env, database, kernel } = input;
  return wireCodeHosts({
    sql: database.sql,
    db: database.db,
    catalog: input.catalog,
    modules: input.modules,
    isEnabled: (moduleId) => kernel.moduleState.isEnabled(moduleId),
    jobs: kernel.jobs,
    secrets: createSecretBox(env.BEMMOLY_SECRET_KEY),
    authorize: input.identity.authorize,
    publicUrl: env.BEMMOLY_PUBLIC_URL,
    allowPrivateUrls: env.BEMMOLY_ALLOW_PRIVATE_URLS,
    logger: input.logger.child({ component: 'code-hosts' }),
  });
}
