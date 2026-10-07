import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Changeset } from '../../contracts/changelog.ts';
import { startTestDatabase, type TestDatabase } from '../../testing/postgres.ts';
import { loadKernelChangelog } from './kernel.ts';
import { createChangelogRunner } from './runner.ts';
import { createTable, freshDatabase, states, tableExists } from './test-support.ts';

describe('changelog runner: rollback, plan, tag and backfill', () => {
  let server: TestDatabase;

  beforeAll(async () => {
    server = await startTestDatabase();
  });

  afterAll(async () => {
    if (server.available) await server.stop();
  });

  it('runs every kernel down and then up again (round trip)', async (ctx) => {
    if (!server.available) return ctx.skip(server.reason);
    const fresh = await freshDatabase(server);
    try {
      const kernel = await loadKernelChangelog();
      const runner = createChangelogRunner({ sql: fresh.sql, kernel, appVersion: '0.1.0' });
      await runner.update({ contexts: ['production'] });
      const rolled = await runner.rollback('core', { count: kernel.length });
      expect(rolled.map((entry) => entry.id)).toEqual(
        kernel.map((changeset) => changeset.id).reverse(),
      );
      expect(await tableExists(fresh.sql, 'settings')).toBe(false);
      expect(Object.values(await states(fresh.sql))).toEqual(kernel.map(() => 'rolled_back'));
      expect((await runner.status()).length).toBe(kernel.length);
      expect((await runner.update({ contexts: ['production'] })).length).toBe(kernel.length);
      expect(await tableExists(fresh.sql, 'settings')).toBe(true);
    } finally {
      await fresh.close();
    }
  });

  it('refuses a rollback that includes an irreversible changeset, before changing anything', async (ctx) => {
    if (!server.available) return ctx.skip(server.reason);
    const fresh = await freshDatabase(server);
    try {
      const lossy = { ...createTable('0002-lossy', 'lossy'), down: undefined };
      const runner = createChangelogRunner({
        sql: fresh.sql,
        kernel: [],
        appVersion: '1',
        modules: [
          {
            module: 'work',
            changelog: [createTable('0001-a', 'a'), { ...lossy, irreversible: true }],
          },
        ],
      });
      await runner.update({ contexts: ['production'] });
      const plan = await runner.rollbackPlan('work', { count: 2 });
      expect(plan.irreversible.map((step) => step.id)).toEqual(['0002-lossy']);
      await expect(runner.rollback('work', { toId: '0001-a' })).rejects.toMatchObject({
        kind: 'irreversible',
      });
      expect(await tableExists(fresh.sql, 'lossy')).toBe(true);
    } finally {
      await fresh.close();
    }
  });

  it('tags the latest changeset and rolls back to the tag across modules', async (ctx) => {
    if (!server.available) return ctx.skip(server.reason);
    const fresh = await freshDatabase(server);
    try {
      const work = { module: 'work', changelog: [createTable('0001-w', 'w')] as Changeset[] };
      const runner = createChangelogRunner({
        sql: fresh.sql,
        kernel: [createTable('0001-k', 'k')],
        appVersion: '1',
        modules: [work],
      });
      await runner.update({ contexts: ['production'], modules: [] });
      expect((await runner.tag('1.2.4')).id).toBe('0001-k');
      await runner.update({ contexts: ['production'], modules: ['work'] });
      await runner.rollback('*', { toTag: '1.2.4' });
      expect(await states(fresh.sql)).toEqual({
        'core/0001-k': 'ran',
        'work/0001-w': 'rolled_back',
      });
    } finally {
      await fresh.close();
    }
  });

  it('prints the SQL a pending update would run without running it', async (ctx) => {
    if (!server.available) return ctx.skip(server.reason);
    const fresh = await freshDatabase(server);
    try {
      const kernel = await loadKernelChangelog();
      const runner = createChangelogRunner({ sql: fresh.sql, kernel, appVersion: '1' });
      const plan = await runner.plan({ contexts: ['production'] });
      expect(plan.map((entry) => [entry.id, entry.action])).toEqual(
        kernel.map((changeset) => [changeset.id, 'run']),
      );
      expect(plan[0]?.statements[0]).toMatch(/^CREATE TABLE settings/);
      expect(await tableExists(fresh.sql, 'settings')).toBe(false);
      expect(await runner.history()).toEqual([]);
    } finally {
      await fresh.close();
    }
  });

  it('backfills in batches and resumes from recorded progress', async (ctx) => {
    if (!server.available) return ctx.skip(server.reason);
    const fresh = await freshDatabase(server);
    try {
      const seed = createTable('0001-items', 'items', {
        up: async (c) => {
          await c.exec(
            sql`create table items (id uuid primary key default uuidv7(), n int, doubled int)`,
          );
          await c.exec(sql`insert into items (n) select g from generate_series(1, 25) g`);
        },
      });
      let batches = 0;
      let crash = true;
      const backfill: Changeset = {
        id: '0002-double',
        author: 'test',
        description: 'fill doubled',
        transactional: false,
        irreversible: true,
        up: async (c) => {
          await c.backfill<{ id: string; n: number }>('items', { batch: 10 }, async (rows) => {
            batches += 1;
            if (crash && batches === 2) throw new Error('worker killed');
            const ids = sql.param(rows.map((r) => r.id));
            await c.exec(sql`update items set doubled = n * 2 where id = any(${ids}::uuid[])`);
          });
        },
      };
      const runner = createChangelogRunner({
        sql: fresh.sql,
        kernel: [seed, backfill],
        appVersion: '1',
      });
      await expect(runner.update({ contexts: ['production'] })).rejects.toThrow(/worker killed/);
      const [started] = await runner
        .history()
        .then((rows) => rows.filter((r) => r.state === 'started'));
      expect(started?.progress).toMatchObject({ '0:items': { rows: 10 } });
      crash = false;
      batches = 0;
      await runner.update({ contexts: ['production'], retryStarted: true });
      expect(batches).toBe(2);
      const [counts] = await fresh.sql<{ filled: string }[]>`
        select count(*) filter (where doubled = n * 2) as filled from items`;
      expect(Number(counts?.filled)).toBe(25);
    } finally {
      await fresh.close();
    }
  });
});
