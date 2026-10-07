import {
  createJobQueueHandle,
  createLocalEventBus,
  createRealtimeService,
  createSettingsReaderHandle,
  loadModules,
  type BemmolyModule,
} from '@bemmoly/core';
import { createLogger, type Env } from '@bemmoly/core/config';
import type { FastifyInstance } from 'fastify';
import { buildApp, type BuildAppOptions } from '../app.ts';
import { connectDatabase, type DatabaseConnection } from './database.ts';
import type { IdentityWiring } from './identity.ts';
import { createDataKernel, type DataKernel } from './kernel.ts';

export interface BootOptions {
  env: Env;
  /** Every module package in the image. */
  available: readonly BemmolyModule[];
  identity: IdentityWiring;
  webRoot?: string;
  logger?: BuildAppOptions['logger'];
}

export interface Booted {
  app: FastifyInstance;
  database?: DatabaseConnection;
  kernel?: DataKernel;
}

/**
 * Connects, applies changesets, loads modules and builds the app. With a
 * database every module in the image is registered and the modules table
 * decides which are enabled, live; without one, BEMMOLY_MODULES does.
 */
export async function bootApplication(options: BootOptions): Promise<Booted> {
  const { env, identity } = options;
  const logger = createLogger(env);
  if (options.logger === false) logger.level = 'silent';
  const database = connectDatabase(env);
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
  const kernel =
    database && realtime && env.DATABASE_URL
      ? await createDataKernel({
          env: { ...env, DATABASE_URL: env.DATABASE_URL },
          sql: database.sql,
          modules,
          realtime,
          jobQueue,
          identity,
          logger,
        })
      : undefined;
  if (kernel) settingsReader.bind(kernel.settings);
  const app = await buildApp({
    env,
    modules,
    ...(options.webRoot ? { webRoot: options.webRoot } : {}),
    ...(options.logger !== undefined ? { logger: options.logger } : {}),
    ...(database ? { database: database.probe } : {}),
    ...(kernel ? { kernel: kernel.routes } : {}),
  });
  return { app, ...(database ? { database } : {}), ...(kernel ? { kernel } : {}) };
}
