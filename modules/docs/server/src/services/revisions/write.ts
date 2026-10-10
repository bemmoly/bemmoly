import type { SqlExecutor } from '@bemmoly/core';
import { plainText, wordCount } from '@bemmoly/editor/convert';
import { NotFoundError, ProviderError } from '@bemmoly/shared';
import type { RichText } from '../../../../shared/common.ts';
import type { RevisionKind } from '../../../../shared/revisions.ts';
import { REVISION_COLUMNS, type RevisionRow } from './rows.ts';

/*
 * Writing a revision: the page's snapshot (or the one given, for a restore)
 * numbered after the last, with everyone who edited since the last revision
 * as its authors. Writing one clears the page's edits-since-revision record,
 * which is what makes the periodic revision periodic.
 */

/** A periodic revision is due once the first edit since the last revision is this old. */
export const PERIODIC_REVISION_MINUTES = 30;

const EMPTY_DOC: RichText = { type: 'doc', content: [{ type: 'paragraph' }] };

export interface RevisionInput {
  pageId: string;
  kind: RevisionKind;
  label?: string | null;
  createdBy: string | null;
  /** Authors to add to those who edited since the last revision. */
  authorIds?: readonly string[];
  /** The content to store instead of the page's own (a restore stores what it restored). */
  snapshot?: RichText;
}

/** Inserts one revision inside the caller's transaction; the page row lock numbers it. */
export async function insertRevision(tx: SqlExecutor, input: RevisionInput): Promise<RevisionRow> {
  const [page] = await tx<
    {
      title: string;
      snapshot: RichText | null;
      text: string;
      word_count: number;
      revision_editor_ids: string[];
    }[]
  >`
    select title, snapshot, text, word_count, revision_editor_ids
    from pages where id = ${input.pageId} and deleted_at is null
    for update`;
  if (!page) throw new NotFoundError('The page was not found');
  const snapshot = input.snapshot ?? page.snapshot ?? EMPTY_DOC;
  const readable = snapshot as Parameters<typeof plainText>[0];
  const text = input.snapshot ? plainText(readable) : page.text;
  const words = input.snapshot ? wordCount(readable) : page.word_count;
  const authors = [...new Set([...page.revision_editor_ids, ...(input.authorIds ?? [])])];
  const [row] = await tx<RevisionRow[]>`
    insert into page_revisions
      (page_id, number, kind, label, title, snapshot, text, word_count, author_ids, created_by)
    select ${input.pageId}, coalesce(max(number), 0) + 1, ${input.kind}, ${input.label ?? null},
      ${page.title}, ${JSON.stringify(snapshot)}::jsonb, ${text}, ${words},
      ${authors}::uuid[], ${input.createdBy}::uuid
    from page_revisions where page_id = ${input.pageId}
    returning ${tx.unsafe(REVISION_COLUMNS)}`;
  if (!row) throw new ProviderError('The revision was not stored');
  await tx`
    update pages set revision_editor_ids = '{}', revision_pending_since = null
    where id = ${input.pageId}`;
  return row;
}

/**
 * The periodic revision, checked whenever edits settle and when the log is
 * compacted: written once the oldest unrevised edit is half an hour old, so
 * a page under active editing gains a revision every 30 minutes and an idle
 * page gains none.
 */
export async function writePeriodicIfDue(
  tx: SqlExecutor,
  pageId: string,
): Promise<RevisionRow | null> {
  const [due] = await tx<{ due: boolean }[]>`
    select revision_pending_since <= now() - make_interval(mins => ${PERIODIC_REVISION_MINUTES})
      as due
    from pages where id = ${pageId} and deleted_at is null`;
  if (!due?.due) return null;
  return insertRevision(tx, { pageId, kind: 'periodic', createdBy: null });
}
