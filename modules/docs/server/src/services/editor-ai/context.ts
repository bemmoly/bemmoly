import type { AiPolicy, SqlExecutor } from '@bemmoly/core';
import { plainText } from '@bemmoly/editor/convert';
import type { RichText } from '../../../../shared/common.ts';

/*
 * The text an editor AI call adds beyond what the editor sent: the page's open comment
 * threads, and the words around a thread's quote. People who opted out of AI are left out
 * of what is sent for someone else, as the privacy rules ask.
 */

const THREAD_LIMIT = 40;
const TEXT_LIMIT = 8000;

interface CommentTextRow {
  id: string;
  parent_id: string | null;
  author_id: string | null;
  author_name: string | null;
  body_text: string;
  quote: string | null;
}

const sendable = (policy: AiPolicy, authorId: string | null) =>
  !authorId || !policy.optedOutUserIds.includes(authorId);

/** The open threads on a page, oldest first, as "Name: text" lines grouped by thread. */
export async function openThreadsText(
  sql: SqlExecutor,
  pageId: string,
  policy: AiPolicy,
): Promise<string> {
  const rows = await sql<CommentTextRow[]>`
    select c.id, c.parent_id, c.author_id, u.name as author_name, c.body_text,
      c.anchor->>'quote' as quote
    from page_comments c
    left join users u on u.id = c.author_id
    left join page_comments root on root.id = coalesce(c.parent_id, c.id)
    where c.page_id = ${pageId} and c.deleted_at is null
      and root.resolved_at is null and root.deleted_at is null
    order by coalesce(root.created_at, c.created_at), c.parent_id nulls first, c.created_at
    limit ${THREAD_LIMIT * 4}`;
  const lines: string[] = [];
  for (const row of rows) {
    if (!sendable(policy, row.author_id)) continue;
    if (!row.parent_id) {
      lines.push(row.quote ? `\nThread on “${row.quote}”:` : '\nThread on the page:');
    }
    lines.push(`- ${row.author_name ?? 'A former member'}: ${row.body_text}`);
  }
  return lines.join('\n').trim().slice(0, TEXT_LIMIT) || 'There are no open threads.';
}

/** A thread's comments, oldest first, without the people who opted out. */
export function threadText(
  rows: readonly { author_id: string | null; author_name: string | null; body_text: string }[],
  policy: AiPolicy,
): string {
  return rows
    .filter((row) => sendable(policy, row.author_id))
    .map((row) => `- ${row.author_name ?? 'A former member'}: ${row.body_text}`)
    .join('\n')
    .slice(0, TEXT_LIMIT);
}

/** About 600 characters either side of the quote in the page's stored text. */
export function aroundQuote(snapshot: RichText | null, quote: string): string {
  const text = snapshot ? plainText(snapshot) : '';
  const at = text.indexOf(quote);
  if (at < 0) return text.slice(0, 1200);
  return text.slice(Math.max(0, at - 600), at + quote.length + 600);
}
