import {
  type ModuleContext,
  type RequestContext,
  type RetrievalChunk,
  type RetrievalDocument,
  type RetrievalSourceDefinition,
  type SqlClient,
} from '@bemmoly/core';
import { ForbiddenError } from '@bemmoly/shared';
import { WORK_REALTIME_KINDS } from '../../../../shared/realtime.ts';
import { accessibleProjectIds, MODULE_RESOURCE } from '../issues/deps.ts';
import { issuePath } from '../issues/notify.ts';
import { WORK_ISSUE_SEARCH } from '../palette/index.ts';

/*
 * What "Ask your docs" and ⌘K questions may read from Work: an issue as its description plus
 * its comments, each comment a chunk of its own so a citation names it and its author's
 * opt-out applies to it alone. Access is the issue list's: the projects the person is in.
 */

interface IssueRow {
  id: string;
  key: string;
  title: string;
  description_text: string;
  project_id: string;
  reporter_id: string | null;
}

interface CommentRow {
  id: string;
  target_id: string;
  author_id: string | null;
  body_text: string;
}

function toDocument(issue: IssueRow, comments: readonly CommentRow[]): RetrievalDocument {
  const description = issue.description_text.trim();
  const chunks: RetrievalChunk[] = [
    {
      text: description || issue.title,
      location: { label: 'Description', part: 'description' },
      authorId: issue.reporter_id,
    },
    ...comments
      .filter((comment) => comment.body_text.trim() !== '')
      .map((comment) => ({
        text: comment.body_text,
        location: { label: 'Comment', part: 'comment' as const, commentId: comment.id },
        authorId: comment.author_id,
      })),
  ];
  return {
    id: issue.id,
    title: `${issue.key} ${issue.title}`,
    path: issuePath(issue.key),
    containerId: issue.project_id,
    chunks,
  };
}

async function readable(ctx: RequestContext, sql: SqlClient): Promise<string[] | null> {
  try {
    await ctx.authz.authorize(ctx.actor, 'work.issue.view', MODULE_RESOURCE);
  } catch (error) {
    if (error instanceof ForbiddenError) return [];
    throw error;
  }
  return accessibleProjectIds(ctx, sql);
}

export function createIssueRetrievalSource(sql: SqlClient): RetrievalSourceDefinition {
  return {
    kind: WORK_ISSUE_SEARCH.kind,
    noun: { one: 'issue', other: 'issues' },
    container: 'project',
    changeKinds: [WORK_REALTIME_KINDS.issue],
    async list({ after, limit }) {
      const rows = await sql<{ id: string }[]>`
        select id from issues
        where deleted_at is null and (${after}::uuid is null or id > ${after}::uuid)
        order by id limit ${limit}`;
      return rows.map((row) => row.id);
    },
    async load(ids) {
      if (ids.length === 0) return [];
      const issues = await sql<IssueRow[]>`
        select id, key, title, description_text, project_id, reporter_id from issues
        where id = any(${ids as string[]}::uuid[]) and deleted_at is null`;
      const comments = await sql<CommentRow[]>`
        select id, target_id, author_id, body_text from comments
        where target_kind = 'issue' and target_id = any(${ids as string[]}::uuid[])
          and deleted_at is null
        order by created_at, id`;
      return issues.map((issue) =>
        toDocument(
          issue,
          comments.filter((comment) => comment.target_id === issue.id),
        ),
      );
    },
    readableContainers: (ctx) => readable(ctx, sql),
    async visible(ctx, ids) {
      const projects = await readable(ctx, sql);
      if (ids.length === 0 || (projects !== null && projects.length === 0)) return new Set();
      const rows = await sql<{ id: string }[]>`
        select id from issues
        where id = any(${ids as string[]}::uuid[]) and deleted_at is null
          and (${projects === null} or project_id = any(${projects ?? []}::uuid[]))`;
      return new Set(rows.map((row) => row.id));
    },
  };
}

/** One line in module.ts: Work's issues are indexable for answers. */
export function registerWorkRetrieval(ctx: Pick<ModuleContext, 'ai' | 'database'>): void {
  if (ctx.database) ctx.ai.addRetrievalSource(createIssueRetrievalSource(ctx.database));
}
