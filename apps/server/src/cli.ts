#!/usr/bin/env node
/**
 * bemmoly-db: changelog and module commands against DATABASE_URL.
 *   node apps/server/src/cli.ts db status|validate|plan|update|history|tag|rollback
 *   node apps/server/src/cli.ts modules list|enable|disable|remove-data
 * The deploy CLI's `bemmoly db …` runs this inside the app container.
 */
import {
  createChangelogRunner,
  createModuleAdmin,
  createModuleState,
  createModuleStateStore,
  createNotifyPublisher,
  createSqlClient,
  DB_USAGE,
  loadKernelChangelog,
  loadModules,
  MODULES_USAGE,
  readEnabledModuleIds,
  runDbCommand,
  runModulesCommand,
  sourcesFromRegistry,
} from '@bemmoly/core';
import { createLogger, loadDatabaseEnv } from '@bemmoly/core/config';
import { systemOnlyAuthorize } from './config/identity.ts';
import { importAvailableModules } from './config/modules.ts';
import { APP_VERSION } from './config/version.ts';

const argv = process.argv.slice(2);
if (argv.length === 0 || argv[0] === '--help') {
  process.stdout.write(`${DB_USAGE}\n\n${MODULES_USAGE}\n`);
  process.exit(argv.length === 0 ? 2 : 0);
}

const env = loadDatabaseEnv();
const sql = createSqlClient(env.DATABASE_URL, {
  applicationName: 'bemmoly-db',
  maxConnections: 3,
  statementTimeoutMs: 0,
});
const logger = createLogger({ LOG_LEVEL: 'fatal', LOG_FORMAT: 'json' });
const registry = loadModules({ available: await importAvailableModules() });
const runner = createChangelogRunner({
  sql,
  kernel: await loadKernelChangelog(),
  modules: sourcesFromRegistry(registry),
  appVersion: APP_VERSION,
});
const contexts = env.BEMMOLY_DB_CONTEXTS;

async function modulesCommand() {
  const store = createModuleStateStore(sql);
  const state = createModuleState({
    registry,
    store,
    runner,
    contexts,
    pinned: env.BEMMOLY_MODULES,
    realtime: createNotifyPublisher(sql),
    logger,
  });
  await state.refresh();
  const admin = createModuleAdmin({
    registry,
    state,
    store,
    runner,
    contexts,
    authorize: systemOnlyAuthorize,
  });
  return runModulesCommand(argv, { admin, actor: { kind: 'system', id: 'bemmoly-db' } });
}

try {
  const result =
    argv[0] === 'modules'
      ? await modulesCommand()
      : await runDbCommand(argv, {
          runner,
          contexts,
          enabledModules: env.BEMMOLY_MODULES.length
            ? env.BEMMOLY_MODULES
            : await readEnabledModuleIds(sql),
        });
  process.stdout.write(`${result.output}\n`);
  process.exitCode = result.exitCode;
} finally {
  await sql.end({ timeout: 5 });
}
