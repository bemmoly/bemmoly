import { createChangelogRunner, createSqlClient, loadKernelChangelog } from '@bemmoly/core';
import {
  createIsolatedDatabase,
  startTestDatabase,
  type TestDatabase,
} from '@bemmoly/core/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import people from '../module.ts';

const TABLES = [
  'journey_tasks',
  'journey_templates',
  'journeys',
  'leave_policies',
  'leave_requests',
  'people_levels',
];

describe('people changelog', () => {
  let server: TestDatabase;

  beforeAll(async () => {
    server = await startTestDatabase();
  });
  afterAll(async () => {
    if (server.available) await server.stop();
  });

  it('applies on the kernel alone, rolls back and applies again', async (ctx) => {
    if (!server.available) return ctx.skip(server.reason);
    const database = await createIsolatedDatabase(server.url);
    const sql = createSqlClient(database.url, { maxConnections: 4 });
    const tables = async () =>
      (
        await sql<{ table_name: string }[]>`
          select table_name from information_schema.tables
          where table_schema = 'public' order by table_name`
      ).map((row) => row.table_name);
    try {
      const runner = createChangelogRunner({
        sql,
        kernel: await loadKernelChangelog(),
        modules: [{ module: 'people', changelog: people.changelog }],
        appVersion: '0.2.0',
      });
      expect(await runner.validate()).toEqual([]);
      await runner.update({ contexts: ['production'] });
      const before = await tables();
      expect(before).toEqual(expect.arrayContaining(TABLES));
      await runner.rollback('people', { count: people.changelog.length });
      const kernelOnly = await tables();
      for (const table of TABLES) expect(kernelOnly).not.toContain(table);
      expect(kernelOnly).toContain('people');
      await runner.update({ contexts: ['production'] });
      expect(await tables()).toEqual(before);
    } finally {
      await sql.end({ timeout: 5 });
      await database.drop();
    }
  });
});
