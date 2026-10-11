import type { SqlClient } from '@bemmoly/core';
import { HttpStatusError } from '@bemmoly/core';
import { plainText } from '@bemmoly/editor/convert';
import type { JiraAttachment, JiraClient, JiraComment, JiraIssue } from '../../../clients/jira.ts';
import { convertText, matchPerson, type RowContext } from './issue-rows.ts';

/*
 * Comments and attachments of the issues one page wrote. Comments keep their author and
 * time; one an earlier run made is updated in place. Attachments are downloaded once (a
 * mapped one is never fetched again), stored in the object store and indexed in
 * attachments; one too large or refused is reported, never fatal.
 */

/** Attachments larger than this are reported instead of copied. */
export const ATTACHMENT_MAX_BYTES = 50 * 1024 * 1024;
const DOWNLOADS_AT_ONCE = 4;

async function commentsOf(client: JiraClient, issue: JiraIssue): Promise<JiraComment[]> {
  const embedded = issue.fields.comment;
  const list = embedded?.comments ?? [];
  if ((embedded?.total ?? list.length) > list.length) return client.comments(issue.key);
  return list;
}

export async function writeComments(
  sql: SqlClient,
  client: JiraClient,
  rows: RowContext,
  written: ReadonlyMap<string, { issue: JiraIssue; id: string }>,
): Promise<void> {
  const { ctx } = rows;
  for (const { issue, id } of written.values()) {
    const comments = await commentsOf(client, issue);
    if (!comments.length) continue;
    const known = await ctx.mappings.getMany(
      'comment',
      comments.map((comment) => comment.id),
    );
    const fresh: { sourceId: string; targetId: string }[] = [];
    for (const comment of comments) {
      const body = convertText(rows, comment.body ?? '');
      const authorId = await matchPerson(rows, comment.author);
      const mapped = known.get(comment.id);
      if (mapped) {
        const [still] = await sql<{ id: string; edited_at: Date | null }[]>`
          select id, edited_at from comments
          where id = ${mapped.targetId} and target_id = ${id} and deleted_at is null`;
        if (still) {
          if (!still.edited_at) {
            await sql`
              update comments set body = ${JSON.stringify(body)}::jsonb,
                body_text = ${plainText(body)}, updated_at = now()
              where id = ${still.id}`;
          }
          ctx.report.count('comments', still.edited_at ? 'skipped' : 'updated');
          continue;
        }
      }
      const [row] = await sql<{ id: string }[]>`
        insert into comments (target_kind, target_id, author_id, body, body_text, created_at)
        values ('issue', ${id}, ${authorId}::uuid, ${JSON.stringify(body)}::jsonb, ${plainText(body)},
          coalesce(${comment.created ?? null}::timestamptz, now()))
        returning id`;
      if (row) fresh.push({ sourceId: comment.id, targetId: row.id });
    }
    await ctx.mappings.setMany('comment', fresh);
    ctx.report.count('comments', 'created', fresh.length);
  }
}

async function copyAttachment(
  sql: SqlClient,
  client: JiraClient,
  rows: RowContext,
  issueId: string,
  attachment: JiraAttachment,
): Promise<void> {
  const { ctx } = rows;
  const label = `${attachment.filename}`;
  if ((attachment.size ?? 0) > ATTACHMENT_MAX_BYTES) {
    ctx.report.skip('attachment', label, 'Larger than 50 MB');
    return;
  }
  let file: { bytes: Uint8Array; contentType: string };
  try {
    file = await client.download(attachment);
  } catch (error) {
    if (
      error instanceof HttpStatusError ||
      (error instanceof Error && /larger than allowed/.test(error.message))
    ) {
      ctx.report.skip(
        'attachment',
        label,
        error instanceof HttpStatusError
          ? `The download answered ${error.status}`
          : 'Larger than 50 MB',
      );
      return;
    }
    throw error;
  }
  const stored = await ctx.files.store({
    bytes: file.bytes,
    contentType: attachment.mimeType ?? file.contentType,
  });
  const uploader = await matchPerson(rows, attachment.author);
  const [row] = await sql<{ id: string }[]>`
    insert into attachments (target_kind, target_id, storage_key, filename, mime, size, sha256,
      uploaded_by, created_at)
    values ('issue', ${issueId}, ${stored.storageKey}, ${attachment.filename.slice(0, 255) || 'file'},
      ${(attachment.mimeType ?? file.contentType).slice(0, 255)}, ${stored.size}, ${stored.sha256},
      ${uploader}::uuid, coalesce(${attachment.created ?? null}::timestamptz, now()))
    returning id`;
  if (row) {
    await ctx.mappings.set('attachment', attachment.id, row.id);
    ctx.report.count('attachments', 'created');
  }
}

export async function writeAttachments(
  sql: SqlClient,
  client: JiraClient,
  rows: RowContext,
  written: ReadonlyMap<string, { issue: JiraIssue; id: string }>,
): Promise<void> {
  const pending = [...written.values()].flatMap(({ issue, id }) =>
    (issue.fields.attachment ?? []).map((attachment) => ({ attachment, id })),
  );
  if (!pending.length) return;
  const known = await rows.ctx.mappings.getMany(
    'attachment',
    pending.map((item) => item.attachment.id),
  );
  const present = new Set(
    (
      await sql<{ id: string }[]>`
        select id from attachments
        where id = any(${[...known.values()].map((mapped) => mapped.targetId)}::uuid[])`
    ).map((row) => row.id),
  );
  const todo = pending.filter((item) => {
    const mapped = known.get(item.attachment.id);
    return !mapped || !present.has(mapped.targetId);
  });
  for (let start = 0; start < todo.length; start += DOWNLOADS_AT_ONCE) {
    await Promise.all(
      todo
        .slice(start, start + DOWNLOADS_AT_ONCE)
        .map((item) => copyAttachment(sql, client, rows, item.id, item.attachment)),
    );
  }
}
