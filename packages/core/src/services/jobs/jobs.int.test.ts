import { pino } from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSqlClient, type SqlClient } from '../../clients/postgres.ts';
import { loadModules } from '../../modules/loader.ts';
import { createIsolatedDatabase, type IsolatedDatabase } from '../../testing/isolated-database.ts';
import { startTestDatabase, type TestDatabase } from '../../testing/postgres.ts';
import { createChangelogRunner, loadKernelChangelog } from '../changelog/index.ts';
import { runHousekeeping } from './housekeeping.ts';
import { createJobsService, type JobsService } from './service.ts';

const logger = pino({ level: 'silent' });

describe('jobs on pg-boss against a real database', () => {
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
    }).update({
      contexts: ['test'],
    });
  });

  afterAll(async () => {
    for (const service of services) await service.stop();
    await sql?.end({ timeout: 5 });
    await database?.drop();
    if (server.available) await server.stop();
  });

  function service(role: 'all' | 'api') {
    if (!sql || !database) throw new Error('no database');
    const jobs = createJobsService({
      sql,
      databaseUrl: database.url,
      role,
      logger,
      modules: loadModules({ available: [] }),
      pollingIntervalSeconds: 0.5,
    });
    services.push(jobs);
    return jobs;
  }

  const waiting = async (name: string) => {
    const rows = await sql!<{ count: string }[]>`
      select count(*) as count from pgboss.job where name = ${name} and state in ('created', 'retry')`;
    return Number(rows[0]?.count);
  };

  it('runs a registered job end to end', async (ctx) => {
    if (!sql) return ctx.skip(server.available ? 'no database' : server.reason);
    const seen: unknown[] = [];
    const jobs = service('all');
    jobs.register('test.echo', async (payload) => void seen.push(payload), { retryLimit: 0 });
    await jobs.start([]);
    expect(await jobs.enqueue('test.echo', { hello: 'world' }, { requestId: 'req-9' })).toEqual(
      expect.any(String),
    );
    await expect.poll(() => seen, { timeout: 15_000 }).toEqual([{ hello: 'world' }]);
  });

  it('drops a singleton duplicate while one waits, and a reused idempotency key', async (ctx) => {
    if (!sql) return ctx.skip(server.available ? 'no database' : server.reason);
    const jobs = service('api');
    jobs.register('test.digest', async () => undefined);
    await jobs.start([]);
    const first = await jobs.enqueue(
      'test.digest',
      { userId: 'u1' },
      { key: 'digest:u1', singleton: true, startAfter: 600 },
    );
    const second = await jobs.enqueue(
      'test.digest',
      { userId: 'u1' },
      { key: 'digest:u1', singleton: true },
    );
    const otherUser = await jobs.enqueue(
      'test.digest',
      { userId: 'u2' },
      { key: 'digest:u2', singleton: true },
    );
    expect(first).toEqual(expect.any(String));
    expect(second).toBeNull();
    expect(otherUser).toEqual(expect.any(String));
    expect(await jobs.enqueue('test.digest', {}, { key: 'import-7' })).toEqual(expect.any(String));
    expect(await jobs.enqueue('test.digest', {}, { key: 'import-7' })).toBeNull();
  });

  it('enqueues inside the caller’s transaction: rolled back, the job never existed', async (ctx) => {
    if (!sql) return ctx.skip(server.available ? 'no database' : server.reason);
    const jobs = service('api');
    jobs.register('test.outbox', async () => undefined);
    await jobs.start([]);
    await expect(
      sql.begin(async (tx) => {
        await jobs.enqueue(
          'test.outbox',
          { outboxId: 'o1' },
          { key: 'email:o1', singleton: true, transaction: tx },
        );
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect(await waiting('test.outbox')).toBe(0);
    await sql.begin(async (tx) => {
      await jobs.enqueue('test.outbox', { outboxId: 'o2' }, { transaction: tx });
    });
    expect(await waiting('test.outbox')).toBe(1);
  });

  it('housekeeping deletes expired idempotency keys and runs registered tasks', async (ctx) => {
    if (!sql) return ctx.skip(server.available ? 'no database' : server.reason);
    await sql`insert into idempotency_keys (scope, key, expires_at)
      values ('job:x', 'old', now() - interval '1 hour'), ('job:x', 'fresh', now() + interval '1 hour')`;
    const result = await runHousekeeping(sql, logger, [{ name: 'sessions', run: async () => 3 }]);
    expect(result).toMatchObject({
      expiredIdempotencyKeys: 1,
      prunedSentEmails: 0,
      tasks: { sessions: 3 },
    });
    const keys = await sql<
      { key: string }[]
    >`select key from idempotency_keys where scope = 'job:x'`;
    expect(keys.map((row) => row.key)).toEqual(['fresh']);
  });
});
