import { decodeCursor, toPage, type RequestContext, type SqlExecutor } from '@bemmoly/core';
import { ForbiddenError, NotFoundError, ValidationError } from '@bemmoly/shared';
import type {
  Comment,
  CommentsPage,
  CreateCommentBody,
  ListCommentsQuery,
  ReactToCommentBody,
  UpdateCommentBody,
} from '../../../../shared/comments.ts';
import { mentionedUserIds, richTextToPlain } from '../../../../shared/rich-text.ts';
import {
  actorUserId,
  iso,
  projectResource,
  requireDatabase,
  type IssueServiceDeps,
} from '../issues/deps.ts';
import { notify, publishIssueChange, watcherIds, type IssueRef } from '../issues/notify.ts';
import { loadIssueById, loadIssueByKey, toIssue, type IssueRow } from '../issues/rows.ts';

/*
 * Comments on an issue: threads through parent_id, reactions as a map of
 * shortcode to the people who reacted, a plain text shadow for search.
 * A new comment reaches the watchers; a mention reaches the person named.
 */

interface CommentRow {
  id: string;
  target_kind: 'issue';
  target_id: string;
  parent_id: string | null;
  author_id: string | null;
  body: Comment['body'];
  body_text: string;
  reactions: Record<string, string[]>;
  ai_run_id: string | null;
  edited_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const COLUMNS = `id, target_kind, target_id, parent_id, author_id, body, body_text, reactions,
  ai_run_id, edited_at, created_at, updated_at`;

const toComment = (row: CommentRow): Comment => ({
  id: row.id,
  targetKind: row.target_kind,
  targetId: row.target_id,
  parentId: row.parent_id,
  authorId: row.author_id,
  body: row.body,
  bodyText: row.body_text,
  reactions: row.reactions,
  aiRunId: row.ai_run_id,
  editedAt: row.edited_at ? iso(row.edited_at) : null,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
});

async function loadComment(sql: SqlExecutor, id: string): Promise<CommentRow> {
  const [row] = await sql<CommentRow[]>`
    select ${sql.unsafe(COLUMNS)} from comments
    where id = ${id} and target_kind = 'issue' and deleted_at is null`;
  if (!row) throw new NotFoundError('The comment was not found');
  return row;
}

const person = (ctx: RequestContext): string => {
  const userId = actorUserId(ctx);
  if (!userId) throw new ForbiddenError('Only a person can comment');
  return userId;
};

async function tellPeople(
  deps: IssueServiceDeps,
  ctx: RequestContext,
  tx: SqlExecutor,
  issue: IssueRef & { title: string },
  comment: Comment,
) {
  const mentioned = mentionedUserIds(comment.body);
  await notify(deps, ctx, tx, issue, {
    kind: 'mention',
    recipientIds: mentioned,
    body: comment.bodyText.slice(0, 500),
    dedupeKey: `comment:${comment.id}:mention`,
  });
  const watchers = (await watcherIds(tx, issue.id)).filter((id) => !mentioned.includes(id));
  await notify(deps, ctx, tx, issue, {
    kind: 'comment',
    recipientIds: watchers,
    body: comment.bodyText.slice(0, 500),
    dedupeKey: `comment:${comment.id}:watchers`,
  });
}

export function createCommentsService(deps: IssueServiceDeps) {
  const issueOf = async (ctx: RequestContext, row: IssueRow) => {
    await ctx.authz.authorize(ctx.actor, 'work.issue.view', projectResource(row.project_id));
    return toIssue(row);
  };

  return {
    async list(ctx: RequestContext, key: string, query: ListCommentsQuery): Promise<CommentsPage> {
      const sql = requireDatabase(deps);
      const issue = await issueOf(ctx, await loadIssueByKey(sql, key));
      const cursor = decodeCursor(query.cursor);
      const rows = await sql<CommentRow[]>`
        select ${sql.unsafe(COLUMNS)} from comments
        where target_kind = 'issue' and target_id = ${issue.id} and deleted_at is null
          ${cursor ? sql`and id > ${cursor}` : sql``}
        order by id
        limit ${query.limit + 1}`;
      const page = toPage(rows, query.limit);
      return { items: page.rows.map(toComment), nextCursor: page.nextCursor };
    },

    async create(ctx: RequestContext, key: string, body: CreateCommentBody): Promise<Comment> {
      const sql = requireDatabase(deps);
      const found = await loadIssueByKey(sql, key);
      await ctx.authz.authorize(ctx.actor, 'work.issue.edit', projectResource(found.project_id));
      const authorId = person(ctx);
      const created = await sql.begin(async (tx) => {
        const issue = toIssue(found);
        if (body.parentId) {
          const parent = await loadComment(tx, body.parentId);
          if (parent.target_id !== issue.id) {
            throw new ValidationError('The parent comment is on another issue');
          }
        }
        const [row] = await tx<CommentRow[]>`
          insert into comments (target_kind, target_id, parent_id, author_id, body, body_text)
          values ('issue', ${issue.id}, ${body.parentId ?? null}, ${authorId},
            ${JSON.stringify(body.body)}::jsonb, ${richTextToPlain(body.body)})
          returning ${tx.unsafe(COLUMNS)}`;
        if (!row) throw new NotFoundError('The comment was not stored');
        await tx`
          insert into watchers (target_kind, target_id, user_id)
          values ('issue', ${issue.id}, ${authorId}) on conflict do nothing`;
        const comment = toComment(row);
        await publishIssueChange(deps, tx, issue);
        await tellPeople(deps, ctx, tx, issue, comment);
        return comment;
      });
      return created as Comment;
    },

    async update(ctx: RequestContext, id: string, body: UpdateCommentBody): Promise<Comment> {
      const sql = requireDatabase(deps);
      const existing = await loadComment(sql, id);
      const issue = await issueOf(ctx, await loadIssueById(sql, existing.target_id));
      if (existing.author_id !== person(ctx)) {
        throw new ForbiddenError('Only the author can edit a comment');
      }
      const updated = await sql.begin(async (tx) => {
        const [row] = await tx<CommentRow[]>`
          update comments set body = ${JSON.stringify(body.body)}::jsonb,
            body_text = ${richTextToPlain(body.body)}, edited_at = now(), updated_at = now()
          where id = ${id}
          returning ${tx.unsafe(COLUMNS)}`;
        if (!row) throw new NotFoundError('The comment was not found');
        const comment = toComment(row);
        await publishIssueChange(deps, tx, issue);
        const newlyMentioned = mentionedUserIds(comment.body).filter(
          (userId) => !mentionedUserIds(existing.body).includes(userId),
        );
        await notify(deps, ctx, tx, issue, {
          kind: 'mention',
          recipientIds: newlyMentioned,
          body: comment.bodyText.slice(0, 500),
          dedupeKey: `comment:${comment.id}:mention:${comment.editedAt}`,
        });
        return comment;
      });
      return updated as Comment;
    },

    async remove(ctx: RequestContext, id: string): Promise<void> {
      const sql = requireDatabase(deps);
      const existing = await loadComment(sql, id);
      const found = await loadIssueById(sql, existing.target_id);
      const resource = projectResource(found.project_id);
      if (existing.author_id !== actorUserId(ctx)) {
        await ctx.authz.authorize(ctx.actor, 'work.issue.delete', resource);
      } else {
        await ctx.authz.authorize(ctx.actor, 'work.issue.edit', resource);
      }
      await sql.begin(async (tx) => {
        await tx`update comments set deleted_at = now(), updated_at = now() where id = ${id}`;
        await publishIssueChange(deps, tx, toIssue(found));
      });
    },

    /** Toggles the actor's reaction; the map holds one list per shortcode. */
    async react(ctx: RequestContext, id: string, body: ReactToCommentBody): Promise<Comment> {
      const sql = requireDatabase(deps);
      const existing = await loadComment(sql, id);
      const issue = await issueOf(ctx, await loadIssueById(sql, existing.target_id));
      const userId = person(ctx);
      const on = body.on ?? true;
      const reacted = await sql.begin(async (tx) => {
        const [locked] = await tx<{ reactions: Record<string, string[]> }[]>`
          select reactions from comments where id = ${id} for update`;
        const reactions = { ...(locked?.reactions ?? {}) };
        const users = (reactions[body.reaction] ?? []).filter((member) => member !== userId);
        if (on) users.push(userId);
        if (users.length > 0) reactions[body.reaction] = users;
        else delete reactions[body.reaction];
        const [row] = await tx<CommentRow[]>`
          update comments set reactions = ${JSON.stringify(reactions)}::jsonb, updated_at = now()
          where id = ${id}
          returning ${tx.unsafe(COLUMNS)}`;
        if (!row) throw new NotFoundError('The comment was not found');
        await publishIssueChange(deps, tx, issue);
        return toComment(row);
      });
      return reacted as Comment;
    },
  };
}

export type CommentsService = ReturnType<typeof createCommentsService>;
