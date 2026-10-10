import type { SqlExecutor } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type { RichText } from '../../../../shared/common.ts';
import type {
  RevisionDetail,
  RevisionKind,
  RevisionSummary,
} from '../../../../shared/revisions.ts';
import { iso } from '../common.ts';

export interface RevisionRow {
  id: string;
  page_id: string;
  number: number;
  kind: RevisionKind;
  label: string | null;
  title: string;
  word_count: number;
  author_ids: string[];
  created_by: string | null;
  created_at: Date | string;
}

export type RevisionRowWithSnapshot = RevisionRow & { snapshot: RichText };

/** Every column a list shows; the snapshot is read only when one revision is opened. */
export const REVISION_COLUMNS = `id, page_id, number, kind, label, title, word_count, author_ids,
  created_by, created_at`;

export const toRevisionSummary = (row: RevisionRow): RevisionSummary => ({
  id: row.id,
  pageId: row.page_id,
  number: row.number,
  kind: row.kind,
  label: row.label,
  title: row.title,
  wordCount: row.word_count,
  authorIds: row.author_ids,
  createdBy: row.created_by,
  createdAt: iso(row.created_at),
});

export const toRevisionDetail = (row: RevisionRowWithSnapshot): RevisionDetail => ({
  ...toRevisionSummary(row),
  snapshot: row.snapshot,
});

/** One revision of one page, with its snapshot; another page's revision is a 404 here. */
export async function revisionById(
  sql: SqlExecutor,
  pageId: string,
  revisionId: string,
): Promise<RevisionRowWithSnapshot> {
  const [row] = await sql<RevisionRowWithSnapshot[]>`
    select ${sql.unsafe(REVISION_COLUMNS)}, snapshot
    from page_revisions where id = ${revisionId} and page_id = ${pageId}`;
  if (!row) throw new NotFoundError('The revision was not found');
  return row;
}
