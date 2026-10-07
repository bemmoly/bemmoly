import { PgBoss } from 'pg-boss';
import type { SqlClient } from '../../clients/postgres.ts';
import type { Logger } from '../../config/logger.ts';
import type { JobQueue } from '../../contracts/jobs.ts';
import type { RealtimeMessage } from '../../contracts/realtime.ts';
import type { ModuleRegistry } from '../../modules/registry.ts';
import type { JobDefinition } from '../../modules/registries.ts';
import { createEnqueue, type KernelEnqueueOptions } from './enqueue.ts';
import { wrapHandler } from './handler.ts';
import { noJobMetrics, type JobMetricsHook } from './metrics.ts';

export type ProcessRole = 'all' | 'api' | 'worker';

export interface JobsServiceOptions {
  sql: SqlClient;
  databaseUrl: string;
  /** BEMMOLY_ROLE: `api` enqueues only; `worker` and `all` also run handlers and schedules. */
  role: ProcessRole;
  logger: Logger;
  modules: ModuleRegistry;
  /** Reads cron expressions for jobs with a scheduleSetting. */
  settings?: { read(key: string): Promise<unknown> };
  /** Kernel jobs, e.g. system.housekeeping. More arrive through register(). */
  kernelJobs?: readonly JobDefinition[];
  pollingIntervalSeconds?: number;
  /** The host passes the observability service's `getMetrics().jobs`. */
  metrics?: JobMetricsHook;
}

/** The kernel's JobQueue on pg-boss, plus lifecycle and module reconciliation. */
export interface JobsService extends JobQueue {
  enqueue(name: string, payload: object, options?: KernelEnqueueOptions): Promise<string | null>;
  start(enabledModules: readonly string[]): Promise<void>;
  stop(): Promise<void>;
  /** Work and schedule exactly the enabled modules' jobs in this process. */
  reconcile(enabledModules: readonly string[]): Promise<void>;
  /** Re-schedules jobs whose cron comes from a setting that changed. */
  handleRealtime(message: RealtimeMessage): Promise<void>;
  isWorker(): boolean;
}

export function createJobsService(options: JobsServiceOptions): JobsService {
  const { logger, modules } = options;
  const metrics = options.metrics ?? noJobMetrics;
  const worker = options.role !== 'api';
  const owned = new Map<string, string>();
  for (const loaded of modules.list()) {
    for (const job of loaded.contributions.jobs) owned.set(job.name, loaded.module.id);
  }
  const definitions = new Map<string, JobDefinition>(
    [...(options.kernelJobs ?? []), ...modules.list().flatMap((m) => m.contributions.jobs)].map(
      (job) => [job.name, job],
    ),
  );
  const working = new Set<string>();
  let boss: PgBoss | undefined;
  let enqueue: ReturnType<typeof createEnqueue> | undefined;

  const cronOf = async (job: JobDefinition): Promise<string | undefined> =>
    job.scheduleSetting && options.settings
      ? String(await options.settings.read(job.scheduleSetting))
      : job.schedule;

  async function createQueue(instance: PgBoss, job: JobDefinition): Promise<void> {
    await instance.createQueue(job.name, {
      policy: job.singleton ? 'singleton' : 'standard',
      retryLimit: job.retryLimit ?? 2,
      retryBackoff: job.retryBackoff ?? true,
      ...(job.retryDelaySeconds !== undefined ? { retryDelay: job.retryDelaySeconds } : {}),
      ...(job.expireInSeconds ? { expireInSeconds: job.expireInSeconds } : {}),
    });
  }

  async function activate(instance: PgBoss, job: JobDefinition): Promise<void> {
    if (!working.has(job.name)) {
      await instance.work(
        job.name,
        {
          batchSize: 1,
          localConcurrency: job.concurrency ?? 1,
          pollingIntervalSeconds: options.pollingIntervalSeconds ?? 2,
        },
        wrapHandler(job, logger, metrics),
      );
      working.add(job.name);
    }
    const cron = await cronOf(job);
    if (cron) await instance.schedule(job.name, cron, null, { tz: 'UTC' });
  }

  async function deactivate(instance: PgBoss, job: JobDefinition): Promise<void> {
    if (working.delete(job.name)) await instance.offWork(job.name);
    if (job.schedule || job.scheduleSetting) await instance.unschedule(job.name);
  }

  async function reconcile(enabledModules: readonly string[]): Promise<void> {
    if (!worker || !boss) return;
    const enabled = new Set(enabledModules);
    for (const [name, moduleId] of owned) {
      const job = definitions.get(name);
      if (job) await (enabled.has(moduleId) ? activate(boss, job) : deactivate(boss, job));
    }
  }

  return {
    isWorker: () => worker,
    register(name, handler, registerOptions = {}) {
      const job: JobDefinition = {
        name,
        handle: (payload, ctx) =>
          handler(payload as never, { jobId: ctx.jobId, signal: ctx.signal }),
        ...(registerOptions.schedule ? { schedule: registerOptions.schedule } : {}),
        ...(registerOptions.retryLimit !== undefined
          ? { retryLimit: registerOptions.retryLimit }
          : {}),
        ...(registerOptions.retryDelaySeconds !== undefined
          ? { retryDelaySeconds: registerOptions.retryDelaySeconds }
          : {}),
        ...(registerOptions.retryBackoff !== undefined
          ? { retryBackoff: registerOptions.retryBackoff }
          : {}),
        ...(registerOptions.concurrency !== undefined
          ? { concurrency: registerOptions.concurrency }
          : {}),
      };
      definitions.set(name, job);
      const instance = boss;
      if (!instance) return;
      // Registered after start: create and work it now; failures are logged, not lost.
      createQueue(instance, job)
        .then(() => (worker ? activate(instance, job) : undefined))
        .catch((error: unknown) =>
          logger.error({ err: error, job: name }, 'job registration failed'),
        );
    },
    enqueue(name, payload, enqueueOptions) {
      if (!enqueue) throw new Error(`Cannot enqueue "${name}": the jobs service has not started`);
      return enqueue(name, payload, enqueueOptions);
    },
    async start(enabledModules) {
      const instance = new PgBoss({
        connectionString: options.databaseUrl,
        schema: 'pgboss',
        application_name: 'bemmoly-jobs',
        max: 4,
        supervise: worker,
        schedule: worker,
        migrate: true,
      });
      instance.on('error', (error) => logger.error({ err: error }, 'job queue error'));
      await instance.start();
      for (const job of definitions.values()) await createQueue(instance, job);
      boss = instance;
      enqueue = createEnqueue(options.sql, instance);
      metrics.observeQueueDepth(async () => {
        if (!boss) return {};
        const queues = await boss.getQueues([...definitions.keys()]);
        return Object.fromEntries(queues.map((queue) => [queue.name, queue.queuedCount]));
      });
      if (worker) {
        for (const job of definitions.values())
          if (!owned.has(job.name)) await activate(instance, job);
        await reconcile(enabledModules);
      }
      logger.info({ role: options.role, queues: definitions.size }, 'jobs started');
    },
    async stop() {
      const instance = boss;
      boss = undefined;
      enqueue = undefined;
      working.clear();
      await instance?.stop({ graceful: true, timeout: 10_000 });
    },
    reconcile,
    async handleRealtime(message) {
      if (!worker || !boss || message.kind !== 'settings.changed') return;
      for (const job of definitions.values()) {
        if (!job.scheduleSetting || !message.ids.includes(job.scheduleSetting)) continue;
        if (owned.has(job.name) && !working.has(job.name)) continue;
        const cron = await cronOf(job);
        if (cron) await boss.schedule(job.name, cron, null, { tz: 'UTC' });
      }
    },
  };
}
