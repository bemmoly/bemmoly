import { fileUrl, HttpStatusError, type SqlClient } from '@bemmoly/core';
import { DOCS_PAGE_KIND } from '../collab/index.ts';
import { plainText } from '@bemmoly/editor/convert';
import { personFor, convertBody, type BodyContext } from './bodies.ts';

/*
 * A page's comments and attachments. Comments keep their author, time and reply thread; an
 * inline comment arrives as a page comment, since its anchor in the old text does not carry
 * over. Attachments are copied into the object store once each and recorded on their mapping;
 * Docs has no attachment panel yet, so the report says where they went.
 */

const ATTACHMENT_MAX_BYTES = 50 * 1024 * 1024;

export async function writeComments(
  sql: SqlClient,
  body: BodyContext,
  spaceKey: string,
  sourcePageId: string,
  pageId: string,
): Promise<void> {
  const { ctx } = body;
  const comments = await body.client.comments(sourcePageId);
  if (!comments.length) return;
  const known = await ctx.mappings.getMany(
    'comment',
    comments.map((comment) => comment.id),
  );
  const made = new Map([...known.entries()].map(([id, mapped]) => [id, mapped.targetId]));
  let inline = 0;
  for (const comment of comments) {
    if (made.has(comment.id)) {
      ctx.report.count('comments', 'skipped');
      continue;
    }
    const parentSource = [...(comment.ancestors ?? [])]
      .reverse()
      .find((ancestor) => made.has(ancestor.id));
    const snapshot = convertBody(body, spaceKey, comment.body?.storage?.value ?? '');
    const authorId = await personFor(body, comment.history?.createdBy);
    if (comment.extensions?.location === 'inline') inline += 1;
    const [row] = await sql<{ id: string }[]>`
      insert into page_comments (page_id, parent_id, author_id, body, body_text, created_at)
      values (${pageId}, ${parentSource ? made.get(parentSource.id)! : null}::uuid,
        ${authorId}::uuid, ${JSON.stringify(snapshot)}::jsonb,
        ${plainText(snapshot as Parameters<typeof plainText>[0])},
        coalesce(${comment.history?.createdDate ?? null}::timestamptz, now()))
      returning id`;
    if (!row) continue;
    made.set(comment.id, row.id);
    await ctx.mappings.set('comment', comment.id, row.id);
    ctx.report.count('comments', 'created');
  }
  if (inline) ctx.report.warn('Inline comments were imported as page comments.');
}

export async function copyAttachments(
  body: BodyContext,
  sourcePageId: string,
  pageId: string,
): Promise<Map<string, string>> {
  const { ctx } = body;
  const urls = new Map<string, string>();
  const attachments = await body.client.attachments(sourcePageId);
  if (!attachments.length) return urls;
  const known = await ctx.mappings.getMany(
    'attachment',
    attachments.map((attachment) => attachment.id),
  );
  for (const attachment of attachments) {
    const fileId = known.get(attachment.id)?.meta['fileId'];
    if (typeof fileId === 'string') urls.set(attachment.title, fileUrl(fileId));
    if (known.has(attachment.id)) continue;
    const size = attachment.extensions?.fileSize ?? 0;
    if (size > ATTACHMENT_MAX_BYTES) {
      ctx.report.skip('attachment', attachment.title, 'Larger than 50 MB');
      continue;
    }
    let file: { bytes: Uint8Array; contentType: string };
    try {
      file = await body.client.download(attachment);
    } catch (error) {
      if (error instanceof HttpStatusError) {
        ctx.report.skip('attachment', attachment.title, `The download answered ${error.status}`);
        continue;
      }
      throw error;
    }
    const mime =
      attachment.extensions?.mediaType ?? attachment.metadata?.mediaType ?? file.contentType;
    const image = mime.startsWith('image/')
      ? await ctx.files.storeImage({
          bytes: file.bytes,
          name: attachment.title,
          target: { kind: DOCS_PAGE_KIND, id: pageId },
        })
      : null;
    const stored = image ? null : await ctx.files.store({ bytes: file.bytes, contentType: mime });
    if (image) urls.set(attachment.title, fileUrl(image));
    await ctx.mappings.set('attachment', attachment.id, pageId, {
      filename: attachment.title,
      mime,
      ...(image ? { fileId: image, size: file.bytes.byteLength } : stored),
    });
    ctx.report.count('attachments', 'created');
  }
  return urls;
}
