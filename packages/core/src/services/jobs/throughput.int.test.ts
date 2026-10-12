import { pino } from 'pino';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createSqlClient, type SqlClient } from '../../clients/postgres.ts';
import type { JobRegisterOptions } from '../../contracts/jobs.ts';
import { loadModules } from '../../modules/loader.ts';
import { createIsolatedDatabase, type IsolatedDatabase } from '../../testing/isolated-database.ts';
import { startTestDatabase, type TestDatabase } from '../../testing/postgres.ts';
import { createChangelogRunner, loadKernelChangelog } from '../changelog/index.ts';
import { createJobsService, type JobsService, type JobsServiceOptions } from './service.ts';

const logger = pino({ level: 'silent' });

/** Counts handlers in flight, keeping the highest count seen. */
function gauge() {
  let now = 0;
  const state = { peak: 0, done: 0 };
  return {
    state,
    async around(task: () => Promise<unknown>): Promise<void> {
      now += 1;
      state.peak = Math.max(state.peak, now);
      try {
        await task();
      } finally {
        now -= 1;
        state.done += 1;
      }
    },
  };
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('job throughput against a real database', () => {
  let server: TestDatabase;
  let database: IsolatedDatabase | undefined;
  let sql: SqlClient | undefined;
  const services: JobsService[] = [];

  beforeAll(async () => {
    server = await startTestDatabase();
    if (!server.available) return;
    database = await createIsolatedDatabase(server.url);
    sql = createSqlClient(database.url, { maxConnections: 6 });
    await createChangelogRunner({
      sql,
      kernel: await loadKernelChangelog(),
      appVersion: '1',
    }).update({ contexts: ['test'] });
  });

  afterEach(async () => {
    for (const service of services.splice(0)) await service.stop();
  });

  afterAll(async () => {
    await sql?.end({ timeout: 5 });
    await database?.drop();
    if (server.available) await server.stop();
  });

  /** The production polling interval: a queue that is not drained continuously shows it. */
  function service(role: 'all' | 'api', options: Partial<JobsServiceOptions> = {}) {
    if (!sql || !database) throw new Error('no database');
    const jobs = createJobsService({
      sql,
      databaseUrl: database.url,
      role,
      logger,
      modules: loadModules({ available: [] }),
      ...options,
    });
    services.push(jobs);
    return jobs;
  }

  /** Queues `count` jobs through a separate api process, so the worker starts on a backlog. */
  async function backlog(name: string, count: number, options: JobRegisterOptions = {}) {
    const api = service('api');
    api.register(name, async () => undefined, options);
    await api.start([]);
    for (let start = 0; start < count; start += 50) {
      const chunk = Array.from({ length: Math.min(50, count - start) }, (_, i) => start + i);
      await Promise.all(chunk.map((i) => api.enqueue(name, { i })));
    }
  }

  it('drains a backlog of 500 no-op jobs in seconds, not one per poll', async (ctx) => {
    if (!sql) return ctx.skip(server.available ? 'no database' : server.reason);
    await backlog('test.noop', 500, { retryLimit: 0 });
    let done = 0;
    const worker = service('all');
    worker.register('test.noop', async () => void (done += 1), { retryLimit: 0 });
    const started = performance.now();
    await worker.start([]);
    // One job per 2 s poll took about 17 minutes for this; the default concurrency of 1 is
    // enough to finish in a second or two.
    await expect.poll(() => done, { timeout: 15_000, interval: 50 }).toBe(500);
    expect(performance.now() - started).toBeLessThan(15_000);
  });

  it('runs a heavy queue one job at a time, a wider queue up to its concurrency', async (ctx) => {
    if (!sql) return ctx.skip(server.available ? 'no database' : server.reason);
    await backlog('test.heavy', 20, { retryLimit: 0 });
    await backlog('test.wide', 40, { retryLimit: 0, concurrency: 3 });
    const heavy = gauge();
    const wide = gauge();
    const worker = service('all');
    worker.register('test.heavy', () => heavy.around(() => pause(25)), { retryLimit: 0 });
    worker.register('test.wide', () => wide.around(() => pause(25)), {
      retryLimit: 0,
      concurrency: 3,
    });
    await worker.start([]);
    await expect.poll(() => heavy.state.done + wide.state.done, { timeout: 15_000 }).toBe(60);
    expect(heavy.state.peak).toBe(1);
    expect(wide.state.peak).toBeGreaterThan(1);
    expect(wide.state.peak).toBeLessThanOrEqual(3);
  });

  it('keeps a singleton queue to one run at once, whatever its concurrency', async (ctx) => {
    if (!sql || !database) return ctx.skip(server.available ? 'no database' : server.reason);
    const runs = gauge();
    const worker = createJobsService({
      sql,
      databaseUrl: database.url,
      role: 'all',
      logger,
      modules: loadModules({ available: [] }),
      kernelJobs: [
        {
          name: 'test.single',
          singleton: true,
          concurrency: 3,
          retryLimit: 0,
          handle: () => runs.around(() => pause(25)),
        },
      ],
    });
    services.push(worker);
    await worker.start([]);
    await Promise.all(Array.from({ length: 12 }, (_, i) => worker.enqueue('test.single', { i })));
    await expect.poll(() => runs.state.done, { timeout: 15_000 }).toBe(12);
    expect(runs.state.peak).toBe(1);
  });

  it('caps job handlers below the pool, so requests still get a connection', async (ctx) => {
    if (!database) return ctx.skip(server.available ? 'no database' : server.reason);
    // A pool of four shared by requests and jobs; two queues that alone would want eight.
    const pool = createSqlClient(database.url, { maxConnections: 4, acquireTimeoutMs: 5_000 });
    try {
      // Each job holds its connection for a full second. A request that had to queue for a
      // connection would wait for one to come back, a large share of that second; one that
      // finds a free connection answers in milliseconds. Comparing against the hold, not a
      // fixed wall-clock budget, keeps the check meaningful on a slow, shared runner.
      const holdMs = 1_000;
      const held = gauge();
      const holdConnection = () =>
        held.around(() => pool.begin((tx) => tx`select pg_sleep(${holdMs / 1_000})`));
      const api = service('api');
      const worker = service('all', { sql: pool, maxConcurrentJobs: 2 });
      for (const name of ['test.fanout-a', 'test.fanout-b']) {
        api.register(name, async () => undefined, { retryLimit: 0, concurrency: 4 });
        worker.register(name, holdConnection, { retryLimit: 0, concurrency: 4 });
      }
      await api.start([]);
      for (let i = 0; i < 3; i += 1) {
        await api.enqueue('test.fanout-a', { i });
        await api.enqueue('test.fanout-b', { i });
      }
      await worker.start([]);
      await expect.poll(() => held.state.peak, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);

      // Requests made while the burst drains answer at once rather than queueing behind it.
      const latencies: number[] = [];
      while (held.state.done < 6) {
        const asked = performance.now();
        await pool`select 1`;
        latencies.push(performance.now() - asked);
        await pause(20);
      }
      expect(Math.max(...latencies)).toBeLessThan(holdMs / 2);
      expect(latencies.length).toBeGreaterThan(10);
      expect(held.state.peak).toBe(2);
    } finally {
      for (const running of services.splice(0)) await running.stop();
      await pool.end({ timeout: 5 });
    }
  });
});
