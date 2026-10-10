import { createChangelogRunner, createSqlClient, loadKernelChangelog } from '@bemmoly/core';
import {
  createIsolatedDatabase,
  startTestDatabase,
  type TestDatabase,
} from '@bemmoly/core/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import docs from '../module.ts';

type Sql = ReturnType<typeof createSqlClient>;

async function tables(sql: Sql): Promise<string[]> {
  const rows = await sql<{ table_name: string }[]>`
    select table_name from information_schema.tables
    where table_schema = 'public' order by table_name`;
  return rows.map((row) => row.table_name);
}

const DOCS_TABLES = [
  'links',
  'page_comments',
  'page_labels',
  'page_revisions',
  'page_stars',
  'page_state',
  'page_updates',
  'pages',
  'spaces',
  'templates',
];

describe('docs changelog', () => {
  let server: TestDatabase;

  beforeAll(async () => {
    server = await startTestDatabase();
  });

  afterAll(async () => {
    if (server.available) await server.stop();
  });

  it('applies on the kernel alone (Work off), rolls back and applies again', async (ctx) => {
    if (!server.available) return ctx.skip(server.reason);
    const database = await createIsolatedDatabase(server.url);
    const sql = createSqlClient(database.url, { maxConnections: 4 });
    try {
      const runner = createChangelogRunner({
        sql,
        kernel: await loadKernelChangelog(),
        modules: [{ module: 'docs', changelog: docs.changelog }],
        appVersion: '0.2.0',
      });
      expect(await runner.validate()).toEqual([]);
      const applied = await runner.update({ contexts: ['production'] });
      expect(applied.filter((entry) => entry.module === 'docs').map((entry) => entry.id)).toEqual(
        docs.changelog.map((changeset) => changeset.id),
      );
      const before = await tables(sql);
      expect(before).toEqual(expect.arrayContaining(DOCS_TABLES));
      expect(before).not.toContain('projects');
      const rolled = await runner.rollback('docs', { count: docs.changelog.length });
      expect(rolled.map((entry) => entry.id)).toEqual(
        docs.changelog.map((changeset) => changeset.id).reverse(),
      );
      const kernelOnly = await tables(sql);
      for (const table of DOCS_TABLES) expect(kernelOnly).not.toContain(table);
      expect(kernelOnly).toContain('space_members');
      expect(await runner.update({ contexts: ['production'] })).toHaveLength(docs.changelog.length);
      expect(await tables(sql)).toEqual(before);
      expect(await runner.status()).toEqual([]);
    } finally {
      await sql.end({ timeout: 5 });
      await database.drop();
    }
  });

  it('seeds the templates once and keeps the search vector and tree checks', async (ctx) => {
    if (!server.available) return ctx.skip(server.reason);
    const database = await createIsolatedDatabase(server.url);
    const sql = createSqlClient(database.url, { maxConnections: 4 });
    try {
      const runner = createChangelogRunner({
        sql,
        kernel: await loadKernelChangelog(),
        modules: [{ module: 'docs', changelog: docs.changelog }],
        appVersion: '0.2.0',
      });
      await runner.update({ contexts: ['production'] });
      const templates = await sql<{ key: string; type: string }[]>`
        select key, snapshot->>'type' as type from templates order by position`;
      expect(templates.map((row) => row.key)).toEqual([
        'rfc',
        'meeting-notes',
        'postmortem',
        'product-spec',
        'runbook',
        'decision-log',
      ]);
      expect(templates.every((row) => row.type === 'doc')).toBe(true);

      const [space] = await sql<{ id: string }[]>`
        insert into spaces (key, name) values ('ENG', 'Engineering') returning id`;
      const [page] = await sql<{ id: string }[]>`
        insert into pages (id, space_id, position, path, title, text)
        values ('01900000-0000-7000-8000-000000000001', ${space!.id}, 'n',
          '/01900000-0000-7000-8000-000000000001/', 'Auth migration', 'Move sessions to Postgres')
        returning id`;
      await sql`insert into page_labels (page_id, name) values (${page!.id}, 'security')`;
      const hits = await sql<{ id: string }[]>`
        select id from pages where search_vector @@ plainto_tsquery('english', 'sessions')
          and search_vector @@ plainto_tsquery('simple', 'security')`;
      expect(hits.map((row) => row.id)).toEqual([page!.id]);
      await expect(
        sql`insert into pages (space_id, position, path) values (${space!.id}, 'na', '/x/')`,
      ).rejects.toThrow(/check/);
    } finally {
      await sql.end({ timeout: 5 });
      await database.drop();
    }
  });
});
