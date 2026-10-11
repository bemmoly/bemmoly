import {
  AI_SETTING_DEFINITIONS,
  createAiHandle,
  createCollabHandle,
  createEnabledModuleCatalog,
  createJobQueueHandle,
  createLocalEventBus,
  createMaintenanceReader,
  createModuleDataBackupHandle,
  createRequestAuthorization,
  createRealtimeService,
  createSettingsReaderHandle,
  EMAIL_SETTING_DEFINITIONS,
  loadModules,
  SYSTEM_SETTINGS,
  type Actor,
  type BemmolyModule,
  type CodeHosts,
  type CollabHost,
  type FetchClientMetadata,
  type Imports,
} from '@bemmoly/core';
import { createLogger, type Env } from '@bemmoly/core/config';
import { getMetrics } from '@bemmoly/core/telemetry';
import type { FastifyInstance } from 'fastify';
import { buildApp, type BuildAppOptions } from '../app.ts';
import { wireAi } from './ai.ts';
import { wireCodeHostIntegrations } from './code-hosts.ts';
import { wireCollab } from './collab.ts';
import { connectDatabase, type DatabaseConnection } from './database.ts';
import { identityWiring } from './identity.ts';
import { wireImporters } from './imports.ts';
import { createDataKernel, type DataKernel } from './kernel.ts';
import { wireMcp } from './mcp.ts';
import { wireRetrieval } from './retrieval.ts';
import { wireKernelServices } from './services.ts';
import { wireOutgoingWebhooks } from './webhooks.ts';

export interface BootOptions {
  env: Env;
  /** Every module package in the image. */
  available: readonly BemmolyModule[];
  webRoot?: string;
  /** `false` silences the process; a stream receives every line, the kernel's and requests'. */
  logger?: BuildAppOptions['logger'];
  /** Tests serve MCP clients' metadata documents without a network; production fetches them. */
  fetchClientMetadata?: FetchClientMetadata;
}

export interface Booted {
  app: FastifyInstance;
  database?: DatabaseConnection;
  kernel?: DataKernel;
  /** Live collaborative documents on /collab; present with a database. */
  collab?: CollabHost;
  /** Settings › Import's service and runner; present with a database. */
  imports?: Imports;
  /** Code hosts' service, webhook receiver and backfill; present with a database. */
  codeHosts?: CodeHosts;
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
  const logger = createLogger(env, options.logger ? options.logger.stream : undefined);
  if (options.logger === false) logger.level = 'silent';
  const database = connectDatabase(env, logger.child({ component: 'database' }));
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
  const aiHandle = createAiHandle();
  // Bound once the kernel reads the modules table; until then no module hears events.
  let moduleState: Pick<DataKernel['moduleState'], 'isEnabled'> | undefined;
  let files: DataKernel['files'] | undefined;
  const modules = loadModules({
    available: options.available,
    enabled: database ? [] : env.BEMMOLY_MODULES,
    events: realtime?.events ?? createLocalEventBus(),
    jobQueue,
    settingsReader,
    collab: collabHandle,
    ai: () => aiHandle.bound(),
    files: () => files,
    ...(realtime ? { realtime: realtime.publisher } : {}),
    ...(database
      ? {
          database: database.sql,
          isEnabled: (moduleId: string) => moduleState?.isEnabled(moduleId) ?? false,
          contextFor: (actor: Actor, context?: { requestId?: string }) => ({
            actor,
            authz: createRequestAuthorization({ db: database.db, modules: catalog }),
            ...(context?.requestId ? { requestId: context.requestId } : {}),
          }),
        }
      : {}),
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
          settingDefinitions: [
            ...EMAIL_SETTING_DEFINITIONS,
            ...SYSTEM_SETTINGS,
            ...AI_SETTING_DEFINITIONS,
          ],
          metrics: { jobs: getMetrics().jobs, realtime: getMetrics().realtime },
          logger,
        })
      : undefined;
  if (kernel) {
    settingsReader.bind(kernel.settings);
    catalog.bindState(kernel.moduleState);
    moduleState = kernel.moduleState;
    files = kernel.files;
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
  const ai =
    database && kernel
      ? await wireAi({ env, database, kernel, identity, modules, handle: aiHandle, logger })
      : undefined;
  const imports =
    database && kernel
      ? wireImporters({ env, database, kernel, identity, modules, logger })
      : undefined;
  const codeHosts =
    database && kernel
      ? wireCodeHostIntegrations({ env, database, kernel, identity, modules, catalog, logger })
      : undefined;
  const retrieval =
    database && kernel && realtime
      ? wireRetrieval({
          sql: database.sql,
          modules,
          moduleState: kernel.moduleState,
          jobs: kernel.jobs,
          listener: realtime.listener,
          events: kernel.events,
          ai: () => aiHandle.current(),
          logger,
        })
      : undefined;
  const mcp =
    database && kernel
      ? wireMcp({
          env,
          database,
          kernel,
          modules,
          ...(options.fetchClientMetadata
            ? { fetchClientMetadata: options.fetchClientMetadata }
            : {}),
        })
      : undefined;
  const webhooks =
    database && kernel
      ? wireOutgoingWebhooks({ env, database, kernel, identity, logger })
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
          aiEnabled: (actor) => aiHandle.enabledFor(actor),
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
      ? {
          kernel: {
            ...kernel.routes,
            ...services?.routes,
            ...ai?.routes,
            ...(retrieval ? { retrieval } : {}),
            ...mcp,
            ...(imports ? { imports: imports.service } : {}),
            ...(codeHosts ? { codeHosts } : {}),
            ...(webhooks ? { webhooks: webhooks.service } : {}),
            ...(collab ? { collab } : {}),
          },
        }
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
    ...(imports ? { imports } : {}),
    ...(codeHosts ? { codeHosts } : {}),
  };
}
