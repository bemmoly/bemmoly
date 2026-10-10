import type { RequestContext } from '@bemmoly/core';
import { plainText } from '@bemmoly/editor/convert';
import { ForbiddenError, ProviderError, ValidationError } from '@bemmoly/shared';
import type {
  CommentsResponse,
  CreateCommentBody,
  ListCommentsQuery,
  PageComment,
  UpdateCommentBody,
} from '../../../../shared/comments.ts';
import { iso, requireDatabase, spaceResource, userIdOf, type DocsServiceDeps } from '../common.ts';
import { readPageDoc } from '../collab/document.ts';
import { pageById } from '../pages/rows.ts';
import { createAnchorReader } from './anchor.ts';
import { createCommentActions } from './actions.ts';
import { mentionedIds, notifyComment, threadPeople } from './notify.ts';
import { COMMENT_COLUMNS, COMMENT_FROM, commentById, toComment, type CommentRow } from './rows.ts';
import { announce, auditComment } from './support.ts';

const textOf = (body: CreateCommentBody['body']) =>
  plainText(body as Parameters<typeof plainText>[0]);

/**
 * Page comments: threads one level deep, page-level or anchored to text, with mentions that
 * reach the inbox. Resolving, reopening, deleting and applying a suggested fix are in
 * actions.ts.
 */
export function createCommentsService(deps: DocsServiceDeps) {
  const sql = () => requireDatabase(deps);

  /** Each anchored comment's status against the page as it is now, read from one copy. */
  async function withStatus(rows: CommentRow[]): Promise<PageComment[]> {
    const anchored = rows.filter((row) => row.anchor);
    if (anchored.length === 0) return rows.map((row) => toComment(row, null));
    const doc = await readPageDoc(sql(), rows[0]!.page_id);
    try {
      const reader = createAnchorReader(doc);
      return rows.map((row) => toComment(row, row.anchor ? reader.status(row.anchor) : null));
    } finally {
      doc.destroy();
    }
  }

  async function one(id: string): Promise<PageComment> {
    return (await withStatus([await commentById(sql(), id)]))[0]!;
  }

  return {
    async list(
      ctx: RequestContext,
      pageId: string,
      query: ListCommentsQuery,
    ): Promise<CommentsResponse> {
      const page = await pageById(sql(), pageId);
      await ctx.authz.authorize(ctx.actor, 'docs.page.view', spaceResource(page.space_id));
      const db = sql();
      const resolved = query.resolved;
      const threadFilter =
        resolved === undefined
          ? db``
          : resolved
            ? db`and t.resolved_at is not null`
            : db`and t.resolved_at is null`;
      const rows = await db<CommentRow[]>`
        select ${db.unsafe(COMMENT_COLUMNS)} from ${db.unsafe(COMMENT_FROM)}
        join page_comments t on t.id = coalesce(c.parent_id, c.id)
        where c.page_id = ${pageId} and c.deleted_at is null ${threadFilter}
        order by c.created_at, c.id
        limit 2000`;
      return { items: await withStatus(rows) };
    },

    async create(
      ctx: RequestContext,
      pageId: string,
      body: CreateCommentBody,
    ): Promise<PageComment> {
      const page = await pageById(sql(), pageId);
      await ctx.authz.authorize(ctx.actor, 'docs.page.edit', spaceResource(page.space_id));
      const authorId = userIdOf(ctx);
      const text = textOf(body.body);
      const id = await sql().begin(async (tx) => {
        let threadId: string | null = null;
        if (body.parentId) {
          const parent = await commentById(tx, body.parentId);
          if (parent.page_id !== pageId) {
            throw new ValidationError('The parent comment is on another page');
          }
          if (parent.parent_id) throw new ValidationError('Replies are one level deep');
          if (body.anchor) throw new ValidationError('A reply follows its thread’s anchor');
          threadId = parent.id;
        }
        const [row] = await tx<{ id: string }[]>`
          insert into page_comments (page_id, parent_id, author_id, body, body_text, anchor)
          values (${pageId}, ${threadId}, ${authorId}::uuid, ${JSON.stringify(body.body)}::jsonb,
            ${text}, ${body.anchor ? JSON.stringify(body.anchor) : null}::jsonb)
          returning id`;
        if (!row) throw new ProviderError('The comment was not stored');
        const notice = {
          id: pageId,
          spaceId: page.space_id,
          title: page.title,
          commentId: row.id,
          text,
        };
        const mentioned = mentionedIds(body.body);
        await notifyComment(deps, ctx, tx, notice, {
          kind: 'mention',
          recipientIds: mentioned,
          dedupeKey: `page-comment:${row.id}:mention`,
        });
        const others = threadId
          ? await threadPeople(tx, threadId)
          : page.owner_id
            ? [page.owner_id]
            : [];
        await notifyComment(deps, ctx, tx, notice, {
          kind: 'comment',
          recipientIds: others.filter((userId) => !mentioned.includes(userId)),
          dedupeKey: `page-comment:${row.id}:comment`,
        });
        await auditComment(deps, ctx, tx, 'page.comment_created', row.id, {
          pageId,
          parentId: threadId,
          inline: Boolean(body.anchor),
        });
        return row.id;
      });
      await announce(deps, page.space_id, pageId);
      return one(id);
    },

    /** Only the author edits a comment; people newly mentioned hear of it. */
    async update(
      ctx: RequestContext,
      commentId: string,
      body: UpdateCommentBody,
    ): Promise<PageComment> {
      const existing = await commentById(sql(), commentId);
      await ctx.authz.authorize(ctx.actor, 'docs.page.view', spaceResource(existing.space_id));
      if (!existing.author_id || existing.author_id !== userIdOf(ctx)) {
        throw new ForbiddenError('Only the author can edit a comment');
      }
      const text = textOf(body.body);
      await sql().begin(async (tx) => {
        const [edited] = await tx<{ edited_at: Date | string }[]>`
          update page_comments set body = ${JSON.stringify(body.body)}::jsonb, body_text = ${text},
            edited_at = now(), updated_at = now()
          where id = ${commentId}
          returning edited_at`;
        const [page] = await tx<{ title: string }[]>`
          select title from pages where id = ${existing.page_id}`;
        const before = new Set(mentionedIds(existing.body));
        await notifyComment(
          deps,
          ctx,
          tx,
          {
            id: existing.page_id,
            spaceId: existing.space_id,
            title: page?.title ?? '',
            commentId,
            text,
          },
          {
            kind: 'mention',
            recipientIds: mentionedIds(body.body).filter((userId) => !before.has(userId)),
            dedupeKey: `page-comment:${commentId}:mention:${edited ? iso(edited.edited_at) : ''}`,
          },
        );
        await auditComment(deps, ctx, tx, 'page.comment_edited', commentId, {
          before: existing.body_text,
          after: text,
        });
      });
      await announce(deps, existing.space_id, existing.page_id);
      return one(commentId);
    },

    ...createCommentActions(deps, one),
  };
}

export type CommentsService = ReturnType<typeof createCommentsService>;
