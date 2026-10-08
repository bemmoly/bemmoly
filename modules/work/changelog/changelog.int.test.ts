import { createChangelogRunner, createSqlClient, loadKernelChangelog } from '@bemmoly/core';
import {
  createIsolatedDatabase,
  startTestDatabase,
  type TestDatabase,
} from '@bemmoly/core/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import work from '../module.ts';

async function tables(sql: ReturnType<typeof createSqlClient>): Promise<string[]> {
  const rows = await sql<{ table_name: string }[]>`
    select table_name from information_schema.tables
    where table_schema = 'public' order by table_name`;
  return rows.map((row) => row.table_name);
}

describe('work changelog', () => {
  let server: TestDatabase;

  beforeAll(async () => {
    server = await startTestDatabase();
  });

  afterAll(async () => {
    if (server.available) await server.stop();
  });

  it('applies on top of the kernel, rolls every changeset back and applies again', async (ctx) => {
    if (!server.available) return ctx.skip(server.reason);
    const database = await createIsolatedDatabase(server.url);
    const sql = createSqlClient(database.url, { maxConnections: 4 });
    try {
      const runner = createChangelogRunner({
        sql,
        kernel: await loadKernelChangelog(),
        modules: [{ module: 'work', changelog: work.changelog }],
        appVersion: '0.2.0',
      });
      expect(await runner.validate()).toEqual([]);
      const applied = await runner.update({ contexts: ['production'] });
      expect(applied.filter((entry) => entry.module === 'work').map((entry) => entry.id)).toEqual(
        work.changelog.map((changeset) => changeset.id),
      );
      const before = await tables(sql);
      expect(before).toEqual(expect.arrayContaining(['projects', 'issues', 'automation_runs']));
      const rolled = await runner.rollback('work', { count: work.changelog.length });
      expect(rolled.map((entry) => entry.id)).toEqual(
        work.changelog.map((changeset) => changeset.id).reverse(),
      );
      const kernelOnly = await tables(sql);
      expect(kernelOnly).not.toContain('projects');
      expect(kernelOnly).toContain('project_members');
      expect(await runner.update({ contexts: ['production'] })).toHaveLength(work.changelog.length);
      expect(await tables(sql)).toEqual(before);
      expect(await runner.status()).toEqual([]);
    } finally {
      await sql.end({ timeout: 5 });
      await database.drop();
    }
  });
});
