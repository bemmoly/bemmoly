import {
  createCollabHandle,
  createEnabledModuleCatalog,
  createJobQueueHandle,
  createLocalEventBus,
  createMaintenanceReader,
  createModuleDataBackupHandle,
  createRealtimeService,
  createSettingsReaderHandle,
  EMAIL_SETTING_DEFINITIONS,
  loadModules,
  SYSTEM_SETTINGS,
  type BemmolyModule,
  type CollabHost,
} from '@bemmoly/core';
import { createLogger, type Env } from '@bemmoly/core/config';
import { getMetrics } from '@bemmoly/core/telemetry';
import type { FastifyInstance } from 'fastify';
import { buildApp, type BuildAppOptions } from '../app.ts';
import { wireCollab } from './collab.ts';
import { connectDatabase, type DatabaseConnection } from './database.ts';
import { identityWiring } from './identity.ts';
import { createDataKernel, type DataKernel } from './kernel.ts';
import { wireKernelServices } from './services.ts';

export interface BootOptions {
  env: Env;
  /** Every module package in the image. */
  available: readonly BemmolyModule[];
  webRoot?: string;
  logger?: BuildAppOptions['logger'];
}

export interface Booted {
  app: FastifyInstance;
  database?: DatabaseConnection;
  kernel?: DataKernel;
  /** Live collaborative documents on /collab; present with a database. */
  collab?: CollabHost;
}

/**
 * Connects, wires identity, applies changesets, loads modules, wires the
 * services built on the kernel and builds the app. With a database every module
 * in the image is registered and the modules table decides which are enabled,
 * live; without one, BEMMOLY_MODULES does and only health and the module list
 * are served.
 */
export async function bootApplication(options: BootOptions): Promise<Booted> {
  const { env } = options;
  const logger = createLogger(env);
  if (options.logger === false) logger.level = 'silent';
  const database = connectDatabase(env);
  const catalog = createEnabledModuleCatalog();
  const backup = createModuleDataBackupHandle();
  const identity = identityWiring(
    database
      ? { db: database.db, modules: catalog, publicUrl: env.BEMMOLY_PUBLIC_URL, backup }
      : undefined,
  );
  const realtime = database
    ? createRealtimeService({
        sql: database.sql,
        logger: logger.child({ component: 'realtime' }),
        hub: {
          ...(identity.moduleAccess ? { moduleAccess: identity.moduleAccess } : {}),
          ...(identity.authorizeSubscription
            ? { authorizeSubscription: identity.authorizeSubscription }
            : {}),
        },
      })
    : undefined;
  const jobQueue = createJobQueueHandle();
  const settingsReader = createSettingsReaderHandle();
  const collabHandle = createCollabHandle();
  const modules = loadModules({
    available: options.available,
    enabled: database ? [] : env.BEMMOLY_MODULES,
    events: realtime?.events ?? createLocalEventBus(),
    jobQueue,
    settingsReader,
    collab: collabHandle,
    ...(realtime ? { realtime: realtime.publisher } : {}),
    ...(database ? { database: database.sql } : {}),
  });
  catalog.bindRegistry(modules);
  const databaseUrl = env.DATABASE_URL;
  const kernel =
    database && realtime && databaseUrl
      ? await createDataKernel({
          env: { ...env, DATABASE_URL: databaseUrl },
          sql: database.sql,
          modules,
          realtime,
          jobQueue,
          identity,
          settingDefinitions: [...EMAIL_SETTING_DEFINITIONS, ...SYSTEM_SETTINGS],
          metrics: { jobs: getMetrics().jobs, realtime: getMetrics().realtime },
          logger,
        })
      : undefined;
  if (kernel) {
    settingsReader.bind(kernel.settings);
    catalog.bindState(kernel.moduleState);
  }
  const collab =
    database && kernel
      ? wireCollab({
          env,
          db: database.db,
          modules,
          catalog,
          moduleState: kernel.moduleState,
          handle: collabHandle,
          logger,
        })
      : undefined;
  const services =
    database && kernel && databaseUrl
      ? wireKernelServices({
          env: { ...env, DATABASE_URL: databaseUrl },
          database,
          kernel,
          identity,
          modules: catalog,
          backup,
          logger,
        })
      : undefined;
  const app = await buildApp({
    env,
    modules,
    maintenance: createMaintenanceReader(env.BEMMOLY_DATA_DIR),
    ...(options.webRoot ? { webRoot: options.webRoot } : {}),
    ...(options.logger !== undefined ? { logger: options.logger } : {}),
    ...(database ? { database: database.probe } : {}),
    ...(kernel
      ? { kernel: { ...kernel.routes, ...services?.routes, ...(collab ? { collab } : {}) } }
      : {}),
    ...(services ? { identity: services.identity } : {}),
  });
  // Before the HTTP server closes: sockets close, pending edits run their hooks and every
  // queued update reaches the database while the pool is still open.
  if (collab) app.addHook('preClose', () => collab.stop());
  return {
    app,
    ...(database ? { database } : {}),
    ...(kernel ? { kernel } : {}),
    ...(collab ? { collab } : {}),
  };
}
