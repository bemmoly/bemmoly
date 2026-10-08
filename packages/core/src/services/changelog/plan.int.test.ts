import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestDatabase, type TestDatabase } from '../../testing/postgres.ts';
import { formatPlan } from './format.ts';
import { loadKernelChangelog } from './kernel.ts';
import { createChangelogRunner } from './runner.ts';
import { createTable, freshDatabase, tableExists } from './test-support.ts';

describe('changelog plan: preconditions', () => {
  let server: TestDatabase;

  beforeAll(async () => {
    server = await startTestDatabase();
  });

  afterAll(async () => {
    if (server.available) await server.stop();
  });

  it('plans the kernel changelog from empty without halting on tables it creates', async (ctx) => {
    if (!server.available) return ctx.skip(server.reason);
    const fresh = await freshDatabase(server);
    try {
      const kernel = await loadKernelChangelog();
      const runner = createChangelogRunner({ sql: fresh.sql, kernel, appVersion: '1' });
      const plan = await runner.plan({ contexts: ['production'] });
      const byId = new Map(plan.map((entry) => [entry.id, entry]));
      for (const id of ['0201-notifications', '0202-notification-preferences']) {
        expect(byId.get(id)).toMatchObject({ action: 'run' });
        expect(byId.get(id)?.note).toBeUndefined();
        expect(byId.get(id)?.statements[0]).toMatch(/create table notification/);
      }
      expect(plan.map((entry) => entry.action)).toEqual(kernel.map(() => 'run'));
      expect(formatPlan(plan)).not.toMatch(/action: halt/);
      expect(await tableExists(fresh.sql, 'users')).toBe(false);
    } finally {
      await fresh.close();
    }
  });

  it('defers data checks earlier changesets could change, and halts on the rest', async (ctx) => {
    if (!server.available) return ctx.skip(server.reason);
    const fresh = await freshDatabase(server);
    try {
      const changelog = [
        createTable('0001-things', 'things'),
        createTable('0002-tags', 'tags', {
          preconditions: [{ rowCount: { table: 'things', expected: 0 }, onFail: 'skip' }],
        }),
        createTable('0003-labels', 'labels', {
          preconditions: [{ tableExists: { table: 'missing' }, onFail: 'halt' }],
        }),
      ];
      const runner = createChangelogRunner({
        sql: fresh.sql,
        kernel: [],
        modules: [{ module: 'work', changelog }],
        appVersion: '1',
      });
      const plan = await runner.plan({ contexts: ['production'] });
      expect(plan.map((entry) => [entry.id, entry.action])).toEqual([
        ['0001-things', 'run'],
        ['0002-tags', 'deferred'],
        ['0003-labels', 'halt'],
      ]);
      expect(plan[1]?.note).toMatch(/^precondition rowCount things could not be checked/);
      expect(plan[1]?.statements).toEqual([
        'create table "tags" (id uuid primary key default uuidv7(), n int);',
      ]);
      expect(plan[2]?.note).toBe('precondition tableExists missing does not hold');
      expect(formatPlan(plan)).toMatch(/-- work\/0002-tags: create tags\n-- action: deferred\n/);
    } finally {
      await fresh.close();
    }
  });
});
