import {
  createAuditActivity,
  createEmailConfigurationProbe,
  createPgTools,
  createRunnerChangelogProbe,
  createTarTool,
  createUpdaterClient,
  type Authorize,
  type Database,
  type EventBus,
  type JobEnqueuer,
  type KernelChangelogRunner,
  type RealtimePublisher,
  type SettingsService,
  type SqlClient,
  type SystemDependencies,
} from '@bemmoly/core';
import type { Env, Logger } from '@bemmoly/core/config';
import { getMetrics } from '@bemmoly/core/telemetry';
import { appVersionOf } from './version.ts';

export interface SystemWiringInput {
  env: Env & { DATABASE_URL: string };
  sql: SqlClient;
  db: Database;
  logger: Logger;
  authorize: Authorize;
  settings: SettingsService;
  runner: KernelChangelogRunner;
  /** Enabled module ids, written into backup manifests and applied by updates. */
  enabledModules: () => readonly string[];
  events?: EventBus;
  jobs?: JobEnqueuer;
  realtime?: RealtimePublisher;
}

/**
 * Backups, updates and system health, as the server and `bemmoly-system` both
 * wire them: the changelog through the runner, audit counts from the audit log,
 * the SMTP check from the email settings, and the updater when the installer
 * configured one.
 */
export function systemDependencies(input: SystemWiringInput): SystemDependencies {
  const { env } = input;
  return {
    config: {
      databaseUrl: env.DATABASE_URL,
      dataDir: env.BEMMOLY_DATA_DIR,
      backupDir: env.BEMMOLY_BACKUP_DIR,
      appVersion: appVersionOf(env),
      role: env.BEMMOLY_ROLE,
      publicUrl: env.BEMMOLY_PUBLIC_URL,
      ...(env.BEMMOLY_BACKUP_PASSPHRASE ? { backupPassphrase: env.BEMMOLY_BACKUP_PASSPHRASE } : {}),
    },
    sql: input.sql,
    pgTools: createPgTools({ binDir: env.BEMMOLY_PG_BIN_DIR }),
    tar: createTarTool(),
    logger: input.logger,
    authorize: input.authorize,
    modules: input.enabledModules,
    settings: input.settings,
    changelog: createRunnerChangelogProbe({
      runner: input.runner,
      contexts: env.BEMMOLY_DB_CONTEXTS,
      enabledModules: input.enabledModules,
    }),
    audit: createAuditActivity(input.db),
    email: createEmailConfigurationProbe(input.settings),
    onGoodBackup: (finishedAt) => getMetrics().backups.recordGoodBackup(finishedAt),
    ...(input.events ? { events: input.events } : {}),
    ...(input.jobs ? { jobs: input.jobs } : {}),
    ...(input.realtime ? { realtime: input.realtime } : {}),
    ...(env.BEMMOLY_UPDATER_URL && env.UPDATER_TOKEN
      ? {
          updater: createUpdaterClient({
            baseUrl: env.BEMMOLY_UPDATER_URL,
            token: env.UPDATER_TOKEN,
          }),
        }
      : {}),
  };
}
