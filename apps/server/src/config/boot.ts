import {
  authenticateRequest,
  createEnabledModuleCatalog,
  createJobQueueHandle,
  createLocalEventBus,
  createRealtimeService,
  createSettingsReaderHandle,
  createUserDirectory,
  EMAIL_SETTING_DEFINITIONS,
  loadModules,
  wireEmailNotifications,
  type BemmolyModule,
} from '@bemmoly/core';
import { createLogger, type Env } from '@bemmoly/core/config';
import type { FastifyInstance } from 'fastify';
import { buildApp, type BuildAppOptions } from '../app.ts';
import { connectDatabase, type DatabaseConnection } from './database.ts';
import { identityRoutes, identityWiring } from './identity.ts';
import { createDataKernel, type DataKernel } from './kernel.ts';

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
}

/**
 * Connects, wires identity, applies changesets, loads modules and builds the
 * app. With a database every module in the image is registered and the
 * modules table decides which are enabled, live; without one, BEMMOLY_MODULES
 * does and only health and the module list are served.
 */
export async function bootApplication(options: BootOptions): Promise<Booted> {
  const { env } = options;
  const logger = createLogger(env);
  if (options.logger === false) logger.level = 'silent';
  const database = connectDatabase(env);
  const catalog = createEnabledModuleCatalog();
  const identity = identityWiring(
    database ? { db: database.db, modules: catalog, publicUrl: env.BEMMOLY_PUBLIC_URL } : undefined,
  );
  const realtime = database
    ? createRealtimeService({
        sql: database.sql,
        logger: logger.child({ component: 'realtime' }),
        hub: identity.moduleAccess ? { moduleAccess: identity.moduleAccess } : {},
      })
    : undefined;
  const jobQueue = createJobQueueHandle();
  const settingsReader = createSettingsReaderHandle();
  const modules = loadModules({
    available: options.available,
    enabled: database ? [] : env.BEMMOLY_MODULES,
    events: realtime?.events ?? createLocalEventBus(),
    jobQueue,
    settingsReader,
    ...(realtime ? { realtime: realtime.publisher } : {}),
    ...(database ? { database: database.sql } : {}),
  });
  catalog.bindRegistry(modules);
  const kernel =
    database && realtime && env.DATABASE_URL
      ? await createDataKernel({
          env: { ...env, DATABASE_URL: env.DATABASE_URL },
          sql: database.sql,
          modules,
          realtime,
          jobQueue,
          identity,
          settingDefinitions: EMAIL_SETTING_DEFINITIONS,
          logger,
        })
      : undefined;
  if (kernel) {
    settingsReader.bind(kernel.settings);
    catalog.bindState(kernel.moduleState);
  }
  const people =
    database && kernel
      ? identityRoutes({
          db: database.db,
          sql: database.sql,
          modules: catalog,
          events: kernel.events,
          settings: kernel.settings,
          publicUrl: env.BEMMOLY_PUBLIC_URL,
        })
      : undefined;
  const mail =
    database && kernel
      ? wireEmailNotifications({
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
        })
      : undefined;
  const app = await buildApp({
    env,
    modules,
    ...(options.webRoot ? { webRoot: options.webRoot } : {}),
    ...(options.logger !== undefined ? { logger: options.logger } : {}),
    ...(database ? { database: database.probe } : {}),
    ...(kernel
      ? { kernel: { ...kernel.routes, ...(mail ? { emailNotifications: mail.routes } : {}) } }
      : {}),
    ...(people ? { identity: people } : {}),
  });
  return { app, ...(database ? { database } : {}), ...(kernel ? { kernel } : {}) };
}
