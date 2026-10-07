import {
  createChangelogRunner,
  createDatabase,
  createNotifyPublisher,
  createSecretBox,
  createSettingsCatalog,
  createSettingsService,
  createSettingsStore,
  createSqlClient,
  createStderrLogger,
  EMAIL_SETTING_DEFINITIONS,
  KERNEL_SETTINGS,
  loadKernelChangelog,
  loadModules,
  readEnabledModuleIds,
  sourcesFromRegistry,
  SYSTEM_SETTINGS,
  type Actor,
  type SqlClient,
  type SystemDependencies,
} from '@bemmoly/core';
import { loadEnv, type Env } from '@bemmoly/core/config';
import { systemOnlyAuthorize } from '../../src/config/identity.ts';
import { importAvailableModules } from '../../src/config/modules.ts';
import { systemDependencies } from '../../src/config/system.ts';
import { APP_VERSION } from '../../src/config/version.ts';

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
 * small pool without the request statement timeout, and logs on stderr. Settings
 * are the workspace's own (their changes reach the server through NOTIFY), and
 * the changelog is read through the runner, as in the server.
 */
export async function createRuntime(): Promise<Runtime> {
  const env = loadEnv();
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new UsageError('DATABASE_URL is not set in /var/bemmoly/.env');
  const sql = createSqlClient(databaseUrl, {
    applicationName: 'bemmoly-system',
    maxConnections: 4,
    statementTimeoutMs: 0,
  });
  const logger = createStderrLogger({
    LOG_LEVEL: env.LOG_LEVEL === 'debug' ? 'debug' : 'warn',
    LOG_FORMAT: 'json',
  });
  const registry = loadModules({ available: await importAvailableModules() });
  const enabled =
    env.BEMMOLY_MODULES.length > 0 ? env.BEMMOLY_MODULES : await readEnabledModuleIds(sql);
  const settings = createSettingsService({
    store: createSettingsStore(sql),
    catalog: createSettingsCatalog(registry, [
      ...KERNEL_SETTINGS,
      ...EMAIL_SETTING_DEFINITIONS,
      ...SYSTEM_SETTINGS,
    ]),
    secrets: createSecretBox(env.BEMMOLY_SECRET_KEY),
    realtime: createNotifyPublisher(sql),
    logger,
  });
  const runner = createChangelogRunner({
    sql,
    kernel: await loadKernelChangelog(),
    modules: sourcesFromRegistry(registry),
    appVersion: APP_VERSION,
  });
  const deps = systemDependencies({
    env: { ...env, DATABASE_URL: databaseUrl },
    sql,
    db: createDatabase(sql),
    logger,
    authorize: systemOnlyAuthorize,
    settings,
    runner,
    enabledModules: () => enabled,
  });
  return { env, sql, deps, close: () => sql.end({ timeout: 5 }) };
}
