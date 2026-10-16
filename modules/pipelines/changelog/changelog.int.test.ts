import { createChangelogRunner, createSqlClient, loadKernelChangelog } from '@bemmoly/core';
import {
  createIsolatedDatabase,
  startTestDatabase,
  type TestDatabase,
} from '@bemmoly/core/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pipelines from '../module.ts';

async function tables(sql: ReturnType<typeof createSqlClient>): Promise<string[]> {
  const rows = await sql<{ table_name: string }[]>`
    select table_name from information_schema.tables
    where table_schema = 'public' order by table_name`;
  return rows.map((row) => row.table_name);
}

describe('pipelines changelog', () => {
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
        modules: [{ module: 'pipelines', changelog: pipelines.changelog }],
        appVersion: '0.1.0',
      });
      expect(await runner.validate()).toEqual([]);
      const applied = await runner.update({ contexts: ['production'] });
      expect(
        applied.filter((entry) => entry.module === 'pipelines').map((entry) => entry.id),
      ).toEqual(pipelines.changelog.map((changeset) => changeset.id));
      const before = await tables(sql);
      const owned = before.filter(
        (name) => name.startsWith('pipeline_') || name.startsWith('cloud_'),
      );
      // Every table this module owns carries its prefix; nothing else is created.
      expect(owned.length).toBeGreaterThanOrEqual(45);
      expect(before).toEqual(
        expect.arrayContaining([
          'pipeline_applications',
          'pipeline_jobs',
          'pipeline_deployment_events',
          'pipeline_current',
          'cloud_connections',
        ]),
      );
      const rolled = await runner.rollback('pipelines', { count: pipelines.changelog.length });
      expect(rolled.map((entry) => entry.id)).toEqual(
        pipelines.changelog.map((changeset) => changeset.id).reverse(),
      );
      const kernelOnly = await tables(sql);
      expect(
        kernelOnly.filter((name) => name.startsWith('pipeline_') || name.startsWith('cloud_')),
      ).toEqual([]);
      await runner.update({ contexts: ['production'] });
      expect(await tables(sql)).toEqual(before);
      expect(await runner.status()).toEqual([]);
    } finally {
      await sql.end({ timeout: 5 });
      await database.drop();
    }
  });
});
