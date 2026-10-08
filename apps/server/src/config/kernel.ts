import {
  createChangelogRunner,
  createJobsService,
  createModuleAdmin,
  createModuleState,
  createModuleStateStore,
  createObjectStore,
  createSecretBox,
  createSettingsAdmin,
  createSettingsCatalog,
  createSettingsService,
  createSettingsStore,
  housekeepingJob,
  KERNEL_SETTINGS,
  loadKernelChangelog,
  sourcesFromRegistry,
  type ClusterEventBus,
  type JobMetricsHook,
  type JobQueueHandle,
  type JobsService,
  type KernelChangelogRunner,
  type KernelRouteDependencies,
  type KernelSettingsService,
  type ModuleRegistry,
  type ModuleState,
  type ObjectStore,
  type RealtimeMetricsHook,
  type RealtimePublisher,
  type RealtimeService,
  type SettingDefinition,
  type SqlClient,
} from '@bemmoly/core';
import type { Env, Logger } from '@bemmoly/core/config';
import type { IdentityWiring } from './identity.ts';
import { appVersionOf } from './version.ts';

export interface DataKernelInput {
  env: Pick<
    Env,
    | 'BEMMOLY_SECRET_KEY'
    | 'BEMMOLY_ROLE'
    | 'BEMMOLY_MODULES'
    | 'BEMMOLY_DATA_DIR'
    | 'BEMMOLY_DB_AUTO_MIGRATE'
    | 'BEMMOLY_DB_CONTEXTS'
    | 'BEMMOLY_VERSION'
  > & { DATABASE_URL: string };
  sql: SqlClient;
  /** Every module in the image, registered with the realtime event bus and job queue. */
  modules: ModuleRegistry;
  realtime: RealtimeService;
  jobQueue: JobQueueHandle;
  identity: IdentityWiring;
  /** The observability service's `getMetrics().jobs` and `.realtime`. */
  metrics?: { jobs: JobMetricsHook; realtime: RealtimeMetricsHook };
  /** Setting definitions of other kernel services, e.g. EMAIL_SETTING_DEFINITIONS. */
  settingDefinitions?: readonly SettingDefinition[];
  logger: Logger;
}

export interface DataKernel {
  routes: Omit<KernelRouteDependencies, 'modules' | 'database'>;
  runner: KernelChangelogRunner;
  settings: KernelSettingsService;
  moduleState: ModuleState;
  objectStore: ObjectStore;
  /** The JobQueue other kernel services register on and enqueue through. */
  jobs: JobsService;
  realtime: RealtimePublisher;
  events: ClusterEventBus;
  start(): Promise<void>;
  stop(): Promise<void>;
}

/**
 * Boot order: kernel changesets, module state (and enabled modules'
 * changesets), settings, jobs. Realtime keeps every replica's caches,
 * enabled set and schedules in step.
 */
export async function createDataKernel(input: DataKernelInput): Promise<DataKernel> {
  const { env, sql, modules, realtime, identity, logger } = input;
  const contexts = env.BEMMOLY_DB_CONTEXTS;
  const runner = createChangelogRunner({
    sql,
    kernel: await loadKernelChangelog(),
    modules: sourcesFromRegistry(modules),
    appVersion: appVersionOf(env),
    logger: logger.child({ component: 'changelog' }),
  });
  if (env.BEMMOLY_DB_AUTO_MIGRATE) await runner.update({ contexts, modules: [] });

  const store = createModuleStateStore(sql);
  const moduleState = createModuleState({
    registry: modules,
    store,
    runner,
    contexts,
    pinned: env.BEMMOLY_MODULES,
    realtime: realtime.publisher,
    logger,
  });
  await moduleState.initialize({ migrate: env.BEMMOLY_DB_AUTO_MIGRATE });

  const settings = createSettingsService({
    store: createSettingsStore(sql),
    catalog: createSettingsCatalog(modules, [
      ...KERNEL_SETTINGS,
      ...(input.settingDefinitions ?? []),
    ]),
    secrets: createSecretBox(env.BEMMOLY_SECRET_KEY),
    realtime: realtime.publisher,
    logger,
  });
  const jobs = createJobsService({
    sql,
    databaseUrl: env.DATABASE_URL,
    role: env.BEMMOLY_ROLE,
    logger: logger.child({ component: 'jobs' }),
    modules,
    settings,
    kernelJobs: [housekeepingJob(sql, logger, identity.housekeeping)],
    ...(input.metrics ? { metrics: input.metrics.jobs } : {}),
  });
  input.jobQueue.bind(jobs);

  realtime.listener.onMessage((message) => settings.handleRealtime(message));
  realtime.listener.onMessage((message) => moduleState.handleRealtime(message));
  realtime.listener.onMessage((message) => jobs.handleRealtime(message));
  moduleState.onChange((enabled) => jobs.reconcile(enabled));

  const moduleAdmin = createModuleAdmin({
    registry: modules,
    state: moduleState,
    store,
    runner,
    contexts,
    authorize: identity.authorize,
    events: realtime.events,
    ...(identity.moduleAccessWriter ? { access: identity.moduleAccessWriter } : {}),
    ...(identity.backup ? { backup: identity.backup } : {}),
  });
  const objectStore = createObjectStore({
    backend: await settings.get('system.storage.backend'),
    dataDir: env.BEMMOLY_DATA_DIR,
  });

  return {
    routes: {
      moduleState,
      moduleAdmin,
      settings: createSettingsAdmin({ settings, authorize: identity.authorize }),
      realtime: realtime.hub,
      ...(input.metrics ? { realtimeMetrics: input.metrics.realtime } : {}),
      ...(identity.authenticate ? { authenticate: identity.authenticate } : {}),
      ...(identity.sessions ? { sessions: identity.sessions } : {}),
      ...(identity.moduleAccess ? { moduleAccess: identity.moduleAccess } : {}),
    },
    runner,
    settings,
    moduleState,
    objectStore,
    jobs,
    realtime: realtime.publisher,
    events: realtime.events,
    async start() {
      await realtime.start();
      await jobs.start(moduleState.enabledIds());
    },
    async stop() {
      await jobs.stop();
      await realtime.stop();
    },
  };
}
