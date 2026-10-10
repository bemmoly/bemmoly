import type { SqlExecutor } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type { RichText } from '../../../../shared/common.ts';
import type {
  AiSuggestion,
  AnchorStatus,
  CommentAnchor,
  PageComment,
} from '../../../../shared/comments.ts';
import { iso, isoOrNull } from '../common.ts';

export interface CommentRow {
  id: string;
  page_id: string;
  space_id: string;
  parent_id: string | null;
  author_id: string | null;
  author_name: string | null;
  body: RichText;
  body_text: string;
  anchor: CommentAnchor | null;
  ai_suggestion: AiSuggestion | null;
  resolved_at: Date | string | null;
  resolved_by: string | null;
  edited_at: Date | string | null;
  created_at: Date | string;
}

/** Every column a comment shows, from page_comments c joined to its page p and author u. */
export const COMMENT_COLUMNS = `c.id, c.page_id, p.space_id, c.parent_id, c.author_id,
  u.name as author_name, c.body, c.body_text, c.anchor, c.ai_suggestion, c.resolved_at,
  c.resolved_by, c.edited_at, c.created_at`;

export const COMMENT_FROM = `page_comments c
  join pages p on p.id = c.page_id
  left join users u on u.id = c.author_id`;

export const toComment = (row: CommentRow, anchorStatus: AnchorStatus | null): PageComment => ({
  id: row.id,
  pageId: row.page_id,
  parentId: row.parent_id,
  author:
    row.author_id && row.author_name !== null ? { id: row.author_id, name: row.author_name } : null,
  body: row.body,
  bodyText: row.body_text,
  anchor: row.anchor,
  anchorStatus: row.anchor ? anchorStatus : null,
  aiSuggestion: row.ai_suggestion,
  resolvedAt: isoOrNull(row.resolved_at),
  resolvedBy: row.resolved_by,
  editedAt: isoOrNull(row.edited_at),
  createdAt: iso(row.created_at),
});

/** A live comment on a live page; anything else is a 404. */
export async function commentById(sql: SqlExecutor, id: string): Promise<CommentRow> {
  const [row] = await sql<CommentRow[]>`
    select ${sql.unsafe(COMMENT_COLUMNS)} from ${sql.unsafe(COMMENT_FROM)}
    where c.id = ${id} and c.deleted_at is null and p.deleted_at is null`;
  if (!row) throw new NotFoundError('The comment was not found');
  return row;
}
