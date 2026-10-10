import type { Actor, SqlClient, SqlExecutor } from '@bemmoly/core';
import { fromConfluence, fromMarkdown, plainText, wordCount } from '@bemmoly/editor/convert';
import { NotFoundError, ProviderError, ValidationError } from '@bemmoly/shared';
import type { RichText } from '../../../../shared/common.ts';
import type { ImportBody, ImportedPage } from '../../../../shared/transfer.ts';
import { bodyEdges, rewriteBodyLinks } from '../links/rewrite.ts';
import { rankAmongSiblings } from '../pages/rank.ts';
import { planImport, type PlannedPage } from './plan.ts';

/*
 * Writes an import: every planned page created under its parent in one transaction (so a
 * failed import leaves nothing behind), then each body converted with the page ids known,
 * so a Confluence link to another page in the same import becomes a live page link.
 */

export interface ImportRun {
  spaceId: string;
  parentId: string | null;
  userId: string | null;
  format: ImportBody['format'];
  files: ImportBody['files'];
}

function countPlaceholders(node: unknown): number {
  if (!node || typeof node !== 'object') return 0;
  const { type, content } = node as { type?: string; content?: unknown[] };
  const own = type === 'unsupportedBlock' ? 1 : 0;
  return own + (content ?? []).reduce<number>((sum, child) => sum + countPlaceholders(child), 0);
}

async function insertPage(
  tx: SqlExecutor,
  run: ImportRun,
  page: PlannedPage,
  parent: { id: string; path: string } | null,
): Promise<{ id: string; path: string }> {
  const position = await rankAmongSiblings(tx, {
    spaceId: run.spaceId,
    parentId: parent?.id ?? null,
  });
  const [row] = await tx<{ id: string; path: string }[]>`
    insert into pages (id, space_id, parent_id, position, path, title, owner_id, created_by,
      updated_by)
    select g.id, ${run.spaceId}, ${parent?.id ?? null}::uuid, ${position},
      ${parent?.path ?? '/'} || g.id::text || '/', ${page.title.slice(0, 500)},
      ${run.userId}::uuid, ${run.userId}::uuid, ${run.userId}::uuid
    from (select uuidv7() as id) g
    returning id, path`;
  if (!row) throw new ProviderError('An imported page was not stored');
  return row;
}

function convert(run: ImportRun, page: PlannedPage, byTitle: Map<string, string>): RichText {
  if (page.content === null) return { type: 'doc', content: [{ type: 'paragraph' }] } as RichText;
  if (run.format === 'markdown') return fromMarkdown(page.content) as RichText;
  return fromConfluence(page.content, {
    resolvePage: (title) => {
      const pageId = byTitle.get(title.toLowerCase());
      return pageId ? { pageId, title } : null;
    },
  }) as RichText;
}

export async function runImport(
  sql: SqlClient,
  run: ImportRun,
  audit: (tx: SqlExecutor, actor: Actor, after: unknown) => Promise<void>,
): Promise<ImportedPage[]> {
  const plan = planImport(run.format, run.files);
  return sql.begin(async (tx) => {
    const [space] = await tx`select id from spaces where id = ${run.spaceId} for update`;
    if (!space) throw new NotFoundError('The space was not found');
    let root: { id: string; path: string } | null = null;
    if (run.parentId) {
      const [parent] = await tx<{ id: string; path: string; space_id: string }[]>`
        select id, path, space_id from pages where id = ${run.parentId} and deleted_at is null`;
      if (!parent) throw new NotFoundError('The parent page was not found');
      if (parent.space_id !== run.spaceId) {
        throw new ValidationError('The parent page is in another space');
      }
      root = parent;
    }
    const created = new Map<string, { id: string; path: string }>();
    for (const page of plan) {
      const parent = page.parentKey ? created.get(page.parentKey)! : root;
      created.set(page.key, await insertPage(tx, run, page, parent));
    }
    const byTitle = new Map(
      plan.map((page) => [page.title.toLowerCase(), created.get(page.key)!.id]),
    );
    const imported: ImportedPage[] = [];
    for (const page of plan) {
      const { id } = created.get(page.key)!;
      const snapshot = convert(run, page, byTitle);
      const readable = snapshot as Parameters<typeof plainText>[0];
      await tx`
        update pages set snapshot = ${JSON.stringify(snapshot)}::jsonb,
          text = ${plainText(readable)}, word_count = ${wordCount(readable)}
        where id = ${id}`;
      await rewriteBodyLinks(tx, id, await bodyEdges({}, snapshot, id), run.userId);
      imported.push({
        id,
        parentId: page.parentKey ? created.get(page.parentKey)!.id : (root?.id ?? null),
        title: page.title,
        path: page.key,
        status: 'draft',
        placeholders: countPlaceholders(snapshot),
      });
    }
    const actor: Actor = run.userId
      ? { kind: 'user', id: run.userId }
      : { kind: 'system', id: 'docs.import' };
    await audit(tx, actor, {
      format: run.format,
      pages: imported.length,
      placeholders: imported.reduce((sum, page) => sum + page.placeholders, 0),
    });
    return imported;
  });
}
