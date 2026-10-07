import {
  createPgTools,
  createSqlAuditActivity,
  createSqlClient,
  createStderrLogger,
  createTarTool,
  createUpdaterClient,
  type Actor,
  type SqlClient,
  type SystemDependencies,
} from '@bemmoly/core';
import { loadEnv, type Env } from '@bemmoly/core/config';
import { importAvailableModules } from '../../src/config/modules.ts';

export interface Runtime {
  env: Env;
  sql: SqlClient;
  deps: SystemDependencies;
  close(): Promise<void>;
}

/** Commands run as root on the host through `bemmoly`, so the actor is the system itself. */
export const CLI_ACTOR: Actor = { kind: 'system', id: 'cli' };

export class UsageError extends Error {
  override readonly name = 'UsageError';
}

/**
 * The system service as the command line sees it: the same env as the server, a
 * small pool without the request statement timeout, and logs on stderr. Settings,
 * events, jobs and the changelog runner are wired by the host process; here their
 * documented defaults apply.
 */
export async function createRuntime(): Promise<Runtime> {
  const env = loadEnv();
  if (!env.DATABASE_URL) throw new UsageError('DATABASE_URL is not set in /var/bemmoly/.env');
  const sql = createSqlClient(env.DATABASE_URL, {
    applicationName: 'bemmoly-system',
    maxConnections: 4,
    statementTimeoutMs: 0,
  });
  const logger = createStderrLogger({
    LOG_LEVEL: env.LOG_LEVEL === 'debug' ? 'debug' : 'warn',
    LOG_FORMAT: 'json',
  });
  const moduleIds =
    env.BEMMOLY_MODULES.length > 0
      ? env.BEMMOLY_MODULES
      : (await importAvailableModules()).map((module) => module.id);
  const deps: SystemDependencies = {
    config: {
      databaseUrl: env.DATABASE_URL,
      dataDir: env.BEMMOLY_DATA_DIR,
      backupDir: env.BEMMOLY_BACKUP_DIR,
      appVersion: env.BEMMOLY_VERSION,
      role: env.BEMMOLY_ROLE,
      publicUrl: env.BEMMOLY_PUBLIC_URL,
      ...(env.BEMMOLY_BACKUP_PASSPHRASE ? { backupPassphrase: env.BEMMOLY_BACKUP_PASSPHRASE } : {}),
    },
    sql,
    pgTools: createPgTools({ binDir: env.BEMMOLY_PG_BIN_DIR }),
    tar: createTarTool(),
    logger,
    authorize: async () => undefined,
    modules: () => moduleIds,
    audit: createSqlAuditActivity(sql),
    ...(env.BEMMOLY_UPDATER_URL && env.UPDATER_TOKEN
      ? {
          updater: createUpdaterClient({
            baseUrl: env.BEMMOLY_UPDATER_URL,
            token: env.UPDATER_TOKEN,
          }),
        }
      : {}),
  };
  return {
    env,
    sql,
    deps,
    close: () => sql.end({ timeout: 5 }),
  };
}
