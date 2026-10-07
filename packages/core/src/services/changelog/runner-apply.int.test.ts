import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSqlClient } from '../../clients/postgres.ts';
import { startTestDatabase, type TestDatabase } from '../../testing/postgres.ts';
import { ChangelogError } from './errors.ts';
import { loadKernelChangelog } from './kernel.ts';
import { createChangelogRunner } from './runner.ts';
import { createTable, freshDatabase, states, tableExists } from './test-support.ts';

describe('changelog runner: update', () => {
  let server: TestDatabase;

  beforeAll(async () => {
    server = await startTestDatabase();
  });

  afterAll(async () => {
    if (server.available) await server.stop();
  });

  it('applies the kernel changelog from empty, once', async (ctx) => {
    if (!server.available) return ctx.skip(server.reason);
    const fresh = await freshDatabase(server);
    try {
      const kernel = await loadKernelChangelog();
      const runner = createChangelogRunner({ sql: fresh.sql, kernel, appVersion: '0.1.0' });
      const applied = await runner.update({ contexts: ['production'] });
      expect(applied.map((entry) => entry.id)).toEqual(kernel.map((changeset) => changeset.id));
      expect(applied.slice(0, 3).map((entry) => entry.id)).toEqual([
        '0001-settings',
        '0002-modules',
        '0003-idempotency-keys',
      ]);
      expect(await tableExists(fresh.sql, 'settings')).toBe(true);
      expect(await runner.status()).toEqual([]);
      expect(await runner.update({ contexts: ['production'] })).toEqual([]);
      const history = await runner.history();
      expect(history.map((row) => [row.module, row.state, row.appVersion])).toEqual(
        kernel.map(() => ['core', 'ran', '0.1.0']),
      );
      expect(history[0]?.checksum).toMatch(/^[0-9a-f]{64}$/);
      expect(await runner.validate()).toEqual([]);
    } finally {
      await fresh.close();
    }
  });

  it('fails on a changed checksum unless validChecksums lists the old one', async (ctx) => {
    if (!server.available) return ctx.skip(server.reason);
    const fresh = await freshDatabase(server);
    try {
      const original = createTable('0001-things', 'things', {
        source: { file: '0001-things.ts', checksum: 'a'.repeat(64) },
      });
      const options = { sql: fresh.sql, kernel: [], appVersion: '0.1.0' };
      const first = createChangelogRunner({
        ...options,
        modules: [{ module: 'work', changelog: [original] }],
      });
      await first.update({ contexts: ['production'] });
      const edited = { ...original, source: { file: '0001-things.ts', checksum: 'b'.repeat(64) } };
      const second = createChangelogRunner({
        ...options,
        modules: [{ module: 'work', changelog: [edited] }],
      });
      const failure = await second.update({ contexts: ['production'] }).catch((e: unknown) => e);
      expect(failure).toBeInstanceOf(ChangelogError);
      expect((failure as ChangelogError).kind).toBe('checksum_mismatch');
      expect((failure as Error).message).toContain('0001-things.ts');
      expect((await second.validate()).map((p) => p.problem)).toEqual(['checksum_mismatch']);
      const accepted = createChangelogRunner({
        ...options,
        modules: [
          {
            module: 'work',
            changelog: [
              { ...edited, validChecksums: [{ checksum: 'a'.repeat(64), reason: 'comment' }] },
            ],
          },
        ],
      });
      expect(await accepted.update({ contexts: ['production'] })).toEqual([]);
      expect((await accepted.history('work'))[0]?.checksum).toBe('b'.repeat(64));
    } finally {
      await fresh.close();
    }
  });

  it('marks a changeset ran when its precondition says the change is already there', async (ctx) => {
    if (!server.available) return ctx.skip(server.reason);
    const fresh = await freshDatabase(server);
    try {
      await fresh.sql`create table legacy (id uuid primary key)`;
      let ran = false;
      const changeset = createTable('0001-legacy', 'legacy', {
        preconditions: [{ not: { tableExists: { table: 'legacy' } }, onFail: 'markRan' }],
        up: async () => {
          ran = true;
        },
      });
      const runner = createChangelogRunner({
        sql: fresh.sql,
        kernel: [changeset],
        appVersion: '0.1.0',
      });
      const [entry] = await runner.update({ contexts: ['production'] });
      expect(entry?.state).toBe('marked_ran');
      expect(ran).toBe(false);
      const halting = createChangelogRunner({
        sql: fresh.sql,
        kernel: [],
        appVersion: '0.1.0',
        modules: [
          {
            module: 'work',
            changelog: [
              createTable('0001-x', 'x', {
                preconditions: [{ tableExists: { table: 'missing' }, onFail: 'halt' }],
              }),
            ],
          },
        ],
      });
      await expect(halting.update({ contexts: ['production'] })).rejects.toMatchObject({
        kind: 'precondition_failed',
      });
    } finally {
      await fresh.close();
    }
  });

  it('runs a changeset only in the contexts it declares', async (ctx) => {
    if (!server.available) return ctx.skip(server.reason);
    const fresh = await freshDatabase(server);
    try {
      const runner = createChangelogRunner({
        sql: fresh.sql,
        kernel: [
          createTable('0001-base', 'base'),
          createTable('0002-demo-data', 'demo_data', { contexts: ['demo', 'test'] }),
        ],
        appVersion: '0.1.0',
      });
      await runner.update({ contexts: ['production'] });
      expect(await tableExists(fresh.sql, 'demo_data')).toBe(false);
      expect(await runner.status({ contexts: ['demo'] })).toEqual([
        { module: 'core', id: '0002-demo-data' },
      ]);
      await runner.update({ contexts: ['demo'] });
      expect(await tableExists(fresh.sql, 'demo_data')).toBe(true);
    } finally {
      await fresh.close();
    }
  });

  it('leaves a visible "started" row when a non-transactional changeset crashes', async (ctx) => {
    if (!server.available) return ctx.skip(server.reason);
    const fresh = await freshDatabase(server);
    try {
      let fail = true;
      const changeset = createTable('0001-index', 'indexed', {
        transactional: false,
        up: async (c) => {
          await c.exec(sql`create table if not exists indexed (id uuid primary key, n int)`);
          if (fail) throw new Error('connection lost');
          await c.exec(sql`create index concurrently if not exists indexed_n_idx on indexed (n)`);
        },
      });
      const runner = createChangelogRunner({
        sql: fresh.sql,
        kernel: [changeset],
        appVersion: '1',
      });
      await expect(runner.update({ contexts: ['production'] })).rejects.toMatchObject({
        kind: 'changeset_failed',
      });
      expect(await states(fresh.sql)).toEqual({ 'core/0001-index': 'started' });
      expect(await tableExists(fresh.sql, 'indexed')).toBe(true);
      await expect(runner.update({ contexts: ['production'] })).rejects.toMatchObject({
        kind: 'started_unfinished',
      });
      fail = false;
      await runner.update({ contexts: ['production'], retryStarted: true });
      expect(await states(fresh.sql)).toEqual({ 'core/0001-index': 'ran' });
    } finally {
      await fresh.close();
    }
  });

  it('rolls a failing transactional changeset back completely', async (ctx) => {
    if (!server.available) return ctx.skip(server.reason);
    const fresh = await freshDatabase(server);
    try {
      const runner = createChangelogRunner({
        sql: fresh.sql,
        kernel: [
          createTable('0001-half', 'half', {
            up: async (c) => {
              await c.exec(sql`create table half (id int)`);
              await c.exec(sql`select * from no_such_table`);
            },
          }),
        ],
        appVersion: '1',
      });
      await expect(runner.update({ contexts: ['production'] })).rejects.toThrow(/no_such_table/);
      expect(await tableExists(fresh.sql, 'half')).toBe(false);
      expect(await states(fresh.sql)).toEqual({});
    } finally {
      await fresh.close();
    }
  });

  it('applies each changeset once when two runners start together', async (ctx) => {
    if (!server.available) return ctx.skip(server.reason);
    const fresh = await freshDatabase(server);
    const other = createSqlClient(fresh.database.url, { maxConnections: 2 });
    try {
      let runs = 0;
      const slow = createTable('0001-slow', 'slow', {
        up: async (c) => {
          runs += 1;
          await c.exec(sql`select pg_sleep(0.5)`);
          await c.exec(sql`create table slow (id int)`);
        },
      });
      const make = (client: typeof other) =>
        createChangelogRunner({ sql: client, kernel: [slow], appVersion: '1' });
      const [a, b] = await Promise.all([
        make(fresh.sql).update({ contexts: ['production'] }),
        make(other).update({ contexts: ['production'] }),
      ]);
      expect(runs).toBe(1);
      expect(a.length + b.length).toBe(1);
      expect(await states(fresh.sql)).toEqual({ 'core/0001-slow': 'ran' });
    } finally {
      await other.end({ timeout: 5 });
      await fresh.close();
    }
  });
});
