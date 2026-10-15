import type { SqlClient } from '@bemmoly/core';
import { plainText, wordCount } from '@bemmoly/editor/convert';
import type { ConfluencePage } from '../../clients/confluence.ts';
import { convertBody, personFor, type BodyContext } from './bodies.ts';

/*
 * Page history, when the admin asks for it: each earlier version of a Confluence page becomes
 * a revision of kind 'imported', oldest first, dated when it was made there, with its author.
 * The current version is the page itself. Each version is mapped once, so a re-run adds only
 * versions made since.
 */

export async function writeVersions(
  sql: SqlClient,
  body: BodyContext,
  spaceKey: string,
  page: ConfluencePage,
  pageId: string,
): Promise<void> {
  const { ctx, client } = body;
  const current = page.version?.number ?? 1;
  if (current <= 1) return;
  const versions = (await client.versions(page.id))
    .filter((version) => version.number < current)
    .sort((a, b) => a.number - b.number);
  const sourceIds = versions.map((version) => `${page.id}:${version.number}`);
  const known = await ctx.mappings.getMany('page_version', sourceIds);
  for (const version of versions) {
    const sourceId = `${page.id}:${version.number}`;
    if (known.has(sourceId)) continue;
    const old = await client.historical(page.id, version.number);
    const snapshot = convertBody(body, spaceKey, old.body?.storage?.value ?? '');
    const readable = snapshot as Parameters<typeof plainText>[0];
    const author = await personFor(body, version.by);
    const when = version.when && !Number.isNaN(Date.parse(version.when)) ? version.when : null;
    await sql.begin(async (tx) => {
      const [row] = await tx<{ id: string }[]>`
        insert into page_revisions
          (page_id, number, kind, label, title, snapshot, text, word_count, author_ids,
           created_by, created_at, updated_at)
        select ${pageId}, coalesce(max(number), 0) + 1, 'imported',
          ${`Version ${version.number} from Confluence`}, ${(old.title || page.title).slice(0, 500)},
          ${JSON.stringify(snapshot)}::jsonb, ${plainText(readable)}, ${wordCount(readable)},
          ${author ? [author] : []}::uuid[], ${author}::uuid,
          coalesce(${when}::timestamptz, now()), now()
        from page_revisions where page_id = ${pageId}
        returning id`;
      if (!row) throw new Error('An imported page version was not stored');
      await ctx.mappings.set('page_version', sourceId, row.id, {}, tx);
    });
    ctx.report.count('page versions', 'created');
  }
}
