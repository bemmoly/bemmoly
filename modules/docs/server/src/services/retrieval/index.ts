import {
  type ModuleContext,
  type RequestContext,
  type RetrievalChunk,
  type RetrievalDocument,
  type RetrievalSourceDefinition,
  type SqlClient,
} from '@bemmoly/core';
import { ForbiddenError } from '@bemmoly/shared';
import { headingIds, plainText } from '@bemmoly/editor/convert';

type RichTextDoc = NonNullable<Parameters<typeof headingIds>[0]>;
import { DOCS_REALTIME_KINDS } from '../../../../shared/realtime.ts';
import { DOCS_MODULE, visibleSpaceIds } from '../common.ts';
import { DOCS_PAGE_SEARCH, pagePath } from '../palette/index.ts';

/*
 * What "Ask your docs" may read from Docs: a page split at its top-level headings, each
 * section a chunk whose anchor is the one the read view gives the heading, so a citation
 * opens the page at that heading. Access is the page list's: the spaces the person is in,
 * never the trash or an archived space.
 */

interface PageRow {
  id: string;
  space_id: string;
  title: string;
  text: string;
  snapshot: RichTextDoc | null;
  author_id: string | null;
}

/** The page's sections: what comes before the first heading, then one per heading. */
export function sectionsOf(page: Pick<PageRow, 'title' | 'text' | 'snapshot'>) {
  const title = page.title || 'Untitled';
  const nodes = page.snapshot?.content ?? [];
  if (nodes.length === 0) return [{ label: title, anchor: undefined, text: page.text }];
  const ids = headingIds(page.snapshot);
  const sections: { label: string; anchor: string | undefined; text: string }[] = [
    { label: title, anchor: undefined, text: '' },
  ];
  let heading = 0;
  for (const node of nodes) {
    if (node.type === 'heading') {
      const label = plainText(node).trim();
      sections.push({ label: label || title, anchor: ids[heading], text: '' });
      heading += 1;
      continue;
    }
    const text = plainText(node).trim();
    if (!text) continue;
    const current = sections.at(-1)!;
    current.text = current.text ? `${current.text}\n${text}` : text;
  }
  return sections.filter((section) => section.text.trim() !== '');
}

function toDocument(page: PageRow): RetrievalDocument {
  const chunks: RetrievalChunk[] = sectionsOf(page).map((section) => ({
    text: section.text,
    location: {
      label: section.label,
      part: 'body',
      ...(section.anchor ? { anchor: section.anchor } : {}),
    },
    authorId: page.author_id,
  }));
  return {
    id: page.id,
    title: page.title || 'Untitled',
    path: pagePath(page.id),
    containerId: page.space_id,
    chunks,
  };
}

async function readable(ctx: RequestContext, sql: SqlClient): Promise<string[] | null> {
  try {
    await ctx.authz.authorize(ctx.actor, 'docs.page.view', DOCS_MODULE);
  } catch (error) {
    if (error instanceof ForbiddenError) return [];
    throw error;
  }
  return visibleSpaceIds(sql, ctx);
}

export function createPageRetrievalSource(sql: SqlClient): RetrievalSourceDefinition {
  return {
    kind: DOCS_PAGE_SEARCH.kind,
    noun: { one: 'page', other: 'pages' },
    container: 'space',
    changeKinds: [DOCS_REALTIME_KINDS.page, DOCS_REALTIME_KINDS.tree],
    async list({ after, limit }) {
      const rows = await sql<{ id: string }[]>`
        select p.id from pages p join spaces s on s.id = p.space_id
        where p.deleted_at is null and s.archived_at is null
          and (${after}::uuid is null or p.id > ${after}::uuid)
        order by p.id limit ${limit}`;
      return rows.map((row) => row.id);
    },
    async load(ids) {
      if (ids.length === 0) return [];
      const rows = await sql<PageRow[]>`
        select p.id, p.space_id, p.title, p.text, p.snapshot,
          coalesce(p.owner_id, p.created_by) as author_id
        from pages p join spaces s on s.id = p.space_id
        where p.id = any(${ids as string[]}::uuid[])
          and p.deleted_at is null and s.archived_at is null`;
      return rows.map(toDocument);
    },
    readableContainers: (ctx) => readable(ctx, sql),
    async visible(ctx, ids) {
      const spaces = await readable(ctx, sql);
      if (ids.length === 0 || (spaces !== null && spaces.length === 0)) return new Set();
      const rows = await sql<{ id: string }[]>`
        select p.id from pages p join spaces s on s.id = p.space_id
        where p.id = any(${ids as string[]}::uuid[])
          and p.deleted_at is null and s.archived_at is null
          and (${spaces === null} or p.space_id = any(${spaces ?? []}::uuid[]))`;
      return new Set(rows.map((row) => row.id));
    },
  };
}

/** One line in module.ts: Docs pages are indexable for answers, by heading. */
export function registerDocsRetrieval(ctx: Pick<ModuleContext, 'ai' | 'database'>): void {
  if (ctx.database) ctx.ai.addRetrievalSource(createPageRetrievalSource(ctx.database));
}
