import { createHash } from 'node:crypto';
import type { ImportMappingStore, SqlClient } from '@bemmoly/core';
import { fromMarkdownBase, plainText } from '@bemmoly/editor/convert';
import type { ImportedComment, ImportedIssue } from '../../../../../shared/issue-import.ts';

/*
 * What follows the issue rows: comments, parents and the source's timestamps. A comment has
 * no id at the source, so it is known by its time, author and words; one sent again is not
 * posted twice. Timestamps go last, after everything that touches the row, and the mapping
 * learns the final updated_at so a re-run still tells an edit here from its own write.
 */

export interface WrittenImport {
  issue: ImportedIssue;
  id: string;
}

type Warn = (externalKey: string, message: string) => void;

export const markdownDocument = (markdown: string) => fromMarkdownBase(markdown);

const commentKey = (externalKey: string, comment: ImportedComment) =>
  `${externalKey}:${createHash('sha256')
    .update(
      [
        new Date(comment.createdAt).toISOString(),
        comment.authorEmail ?? '',
        comment.authorName ?? '',
        comment.bodyMarkdown,
      ].join('\n'),
    )
    .digest('hex')
    .slice(0, 32)}`;

/** Someone with no account here keeps their name and date in the words of the comment. */
function commentBody(comment: ImportedComment, authorId: string | null) {
  if (authorId) return markdownDocument(comment.bodyMarkdown);
  const who = comment.authorName ?? comment.authorEmail ?? 'someone';
  const when = new Date(comment.createdAt).toISOString().slice(0, 10);
  return markdownDocument(`*Originally by ${who} on ${when}*\n\n${comment.bodyMarkdown}`);
}

export async function writeImportedComments(
  sql: SqlClient,
  written: readonly WrittenImport[],
  mappings: ImportMappingStore,
  users: ReadonlyMap<string, string>,
  callerId: string | null,
): Promise<void> {
  for (const { issue, id } of written) {
    const comments = issue.comments ?? [];
    if (!comments.length) continue;
    const keyed = comments.map((comment) => ({
      comment,
      key: commentKey(issue.externalKey, comment),
    }));
    const known = await mappings.getMany(
      'comment',
      keyed.map((item) => item.key),
    );
    const posted = new Set<string>();
    for (const { comment, key } of keyed) {
      if (known.has(key) || posted.has(key)) continue;
      posted.add(key);
      const matched = comment.authorEmail ? (users.get(comment.authorEmail) ?? null) : null;
      const body = commentBody(comment, matched);
      // The comment and its mapping commit together, so a retry never posts it twice.
      await sql.begin(async (tx) => {
        const [row] = await tx<{ id: string }[]>`
          insert into comments (target_kind, target_id, author_id, body, body_text, created_at,
            updated_at)
          values ('issue', ${id}, ${matched ?? callerId}::uuid, ${JSON.stringify(body)}::jsonb,
            ${plainText(body)}, ${comment.createdAt}::timestamptz, ${comment.createdAt}::timestamptz)
          returning id`;
        if (row) await mappings.set('comment', key, row.id, undefined, tx);
      });
    }
  }
}

/** Parents by external key, from this batch or an earlier one into the same project. */
export async function writeImportedParents(
  sql: SqlClient,
  written: readonly WrittenImport[],
  mappings: ImportMappingStore,
  warn: Warn,
): Promise<void> {
  const wanted = written.filter((item) => item.issue.parentExternalKey);
  if (!wanted.length) return;
  const parents = await mappings.getMany(
    'issue',
    wanted.map((item) => item.issue.parentExternalKey as string),
  );
  const pairs: { id: string; parent: string }[] = [];
  for (const { issue, id } of wanted) {
    const parent = parents.get(issue.parentExternalKey as string)?.targetId;
    if (!parent || parent === id) {
      warn(issue.externalKey, `Its parent ${issue.parentExternalKey} was not imported`);
      continue;
    }
    pairs.push({ id, parent });
  }
  if (!pairs.length) return;
  await sql`
    update issues i set parent_id = p.parent
    from jsonb_to_recordset(${JSON.stringify(pairs)}::jsonb) as p(id uuid, parent uuid)
    where i.id = p.id and exists (
      select 1 from issues t where t.id = p.parent and t.project_id = i.project_id
        and t.deleted_at is null)`;
}

/** The source's created and updated times; returns each issue's final updated_at. */
export async function writeImportedTimes(
  sql: SqlClient,
  written: readonly WrittenImport[],
): Promise<Map<string, number>> {
  if (!written.length) return new Map();
  const times = written.map(({ issue, id }) => ({
    id,
    created_at: issue.createdAt ?? null,
    updated_at: issue.updatedAt ?? null,
  }));
  const rows = await sql<{ id: string; updated_at: Date | string }[]>`
    update issues i set created_at = coalesce(t.created_at, i.created_at),
      updated_at = coalesce(t.updated_at, i.updated_at)
    from jsonb_to_recordset(${JSON.stringify(times)}::jsonb)
      as t(id uuid, created_at timestamptz, updated_at timestamptz)
    where i.id = t.id
    returning i.id, i.updated_at`;
  return new Map(rows.map((row) => [row.id, new Date(row.updated_at).getTime()]));
}
