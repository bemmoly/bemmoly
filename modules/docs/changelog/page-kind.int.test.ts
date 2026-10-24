import { createChangelogRunner, createSqlClient, loadKernelChangelog } from '@bemmoly/core';
import {
  createIsolatedDatabase,
  startTestDatabase,
  type TestDatabase,
} from '@bemmoly/core/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import docs from '../module.ts';

/*
 * Pages stored before kinds: one made by Upload HTML or PDF (an empty paragraph, then its
 * file) becomes a file page; a page with words beside a file, or none, stays written.
 */
describe('page kind backfill', () => {
  let server: TestDatabase;

  beforeAll(async () => {
    server = await startTestDatabase();
  });

  afterAll(async () => {
    if (server.available) await server.stop();
  });

  it('makes upload pages file pages and leaves the rest written', async (ctx) => {
    if (!server.available) return ctx.skip(server.reason);
    const database = await createIsolatedDatabase(server.url);
    const sql = createSqlClient(database.url, { maxConnections: 4 });
    try {
      const runner = (
        changelog: typeof docs.changelog,
        kernel: Awaited<ReturnType<typeof loadKernelChangelog>>,
      ) =>
        createChangelogRunner({
          sql,
          kernel,
          modules: [{ module: 'docs', changelog }],
          appVersion: '0.2.0',
        });
      await runner(
        docs.changelog.filter((entry) => entry.id < '0022'),
        await loadKernelChangelog(),
      ).update({ contexts: ['production'] });
      const [space] = await sql<{ id: string }[]>`
        insert into spaces (key, name) values ('UPL', 'Uploads') returning id`;
      const file = { type: 'file', attrs: { src: '/x', name: 'q3.html', mime: 'text/html' } };
      const words = { type: 'paragraph', content: [{ type: 'text', text: 'Notes' }] };
      const page = async (position: string, content: object[] | null) => {
        const [row] = await sql<{ id: string }[]>`
          insert into pages (id, space_id, position, path, title, snapshot)
          select g.id, ${space!.id}, ${position}, '/' || g.id::text || '/', 'Page',
            ${content ? JSON.stringify({ type: 'doc', content }) : null}::jsonb
          from (select uuidv7() as id) g returning id`;
        return row!.id;
      };
      const upload = await page('b', [{ type: 'paragraph' }, file]);
      const annotated = await page('c', [file, words]);
      const empty = await page('d', null);

      await runner(docs.changelog, []).update({ contexts: ['production'] });
      const rows = await sql<{ id: string; kind: string }[]>`select id, kind from pages`;
      const kindOf = new Map(rows.map((row) => [row.id, row.kind]));
      expect(kindOf.get(upload)).toBe('file');
      expect(kindOf.get(annotated)).toBe('page');
      expect(kindOf.get(empty)).toBe('page');
    } finally {
      await sql.end({ timeout: 5 });
      await database.drop();
    }
  });
});
