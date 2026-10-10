import type { RequestContext } from '@bemmoly/core';
import { ConflictError, ForbiddenError, ProviderError, ValidationError } from '@bemmoly/shared';
import type { AiSuggestion, PageComment } from '../../../../shared/comments.ts';
import {
  DOCS_REALTIME_KINDS,
  publishChange,
  requireDatabase,
  spaceResource,
  userIdOf,
  type DocsServiceDeps,
} from '../common.ts';
import { DOCS_PAGE_KIND } from '../collab/index.ts';
import { commentById, type CommentRow } from './rows.ts';
import { applyReplacement } from './suggestion.ts';
import { announce, auditComment } from './support.ts';

/*
 * What happens to a thread after it is written: resolving and reopening it, deleting a
 * comment, and the "Apply fix" path for a suggested change. A fix is applied through the
 * collab host's transaction on the live document, so it lands for everyone with the page
 * open and is stored like any edit; it is never a write to the snapshot.
 */
export function createCommentActions(
  deps: DocsServiceDeps,
  one: (id: string) => Promise<PageComment>,
) {
  const sql = () => requireDatabase(deps);

  async function thread(ctx: RequestContext, commentId: string): Promise<CommentRow> {
    const row = await commentById(sql(), commentId);
    await ctx.authz.authorize(ctx.actor, 'docs.page.edit', spaceResource(row.space_id));
    if (row.parent_id) throw new ValidationError('Resolve the thread, not a reply');
    return row;
  }

  async function setResolved(ctx: RequestContext, commentId: string, resolved: boolean) {
    const row = await thread(ctx, commentId);
    await sql().begin(async (tx) => {
      await tx`
        update page_comments set
          resolved_at = case when ${resolved} then now() else null end,
          resolved_by = ${resolved ? userIdOf(ctx) : null}::uuid,
          updated_at = now()
        where id = ${commentId}`;
      const action = resolved ? 'page.comment_resolved' : 'page.comment_reopened';
      await auditComment(deps, ctx, tx, action, commentId, { pageId: row.page_id });
    });
    await announce(deps, row.space_id, row.page_id);
    return one(commentId);
  }

  return {
    resolve: (ctx: RequestContext, commentId: string) => setResolved(ctx, commentId, true),
    reopen: (ctx: RequestContext, commentId: string) => setResolved(ctx, commentId, false),

    /** The author deletes with edit rights; anyone else needs docs.page.delete. A thread takes its replies. */
    async remove(ctx: RequestContext, commentId: string): Promise<void> {
      const row = await commentById(sql(), commentId);
      const own = row.author_id !== null && row.author_id === userIdOf(ctx);
      const capability = own ? 'docs.page.edit' : 'docs.page.delete';
      await ctx.authz.authorize(ctx.actor, capability, spaceResource(row.space_id));
      await sql().begin(async (tx) => {
        await tx`
          update page_comments set deleted_at = now(), updated_at = now()
          where (id = ${commentId} or parent_id = ${commentId}) and deleted_at is null`;
        await auditComment(deps, ctx, tx, 'page.comment_deleted', commentId, {
          pageId: row.page_id,
          bodyText: row.body_text,
        });
      });
      await announce(deps, row.space_id, row.page_id);
    },

    /**
     * Applies the thread's suggested fix to the live page and resolves the thread. A fix
     * written against text that has since changed is a conflict, and nothing is applied.
     */
    async applySuggestion(ctx: RequestContext, commentId: string): Promise<PageComment> {
      const row = await thread(ctx, commentId);
      const suggestion = row.ai_suggestion;
      if (!suggestion || !row.anchor) throw new ValidationError('This thread has no fix to apply');
      if (suggestion.appliedAt) throw new ConflictError('This fix was already applied');
      if (!deps.collab) throw new ProviderError('Fixes are applied through the collab server');
      const anchor = row.anchor;
      let applied = false;
      await deps.collab.transact(
        DOCS_PAGE_KIND,
        row.page_id,
        (doc) => void (applied = applyReplacement(doc, anchor, suggestion.replacement)),
        ctx.actor,
      );
      if (!applied) {
        throw new ConflictError('The text changed since this fix was suggested; edit it by hand');
      }
      const userId = userIdOf(ctx);
      const done: AiSuggestion = {
        ...suggestion,
        appliedAt: new Date().toISOString(),
        appliedBy: userId,
      };
      await sql().begin(async (tx) => {
        await tx`
          update page_comments set ai_suggestion = ${JSON.stringify(done)}::jsonb,
            resolved_at = coalesce(resolved_at, now()),
            resolved_by = coalesce(resolved_by, ${userId}::uuid), updated_at = now()
          where id = ${commentId}`;
        await auditComment(deps, ctx, tx, 'page.comment_fix_applied', commentId, {
          pageId: row.page_id,
          quote: anchor.quote,
          replacement: suggestion.replacement,
        });
      });
      await announce(deps, row.space_id, row.page_id);
      await publishChange(deps, DOCS_REALTIME_KINDS.page, row.space_id, [row.page_id]);
      return one(commentId);
    },

    /**
     * Stores a suggested fix on an inline thread, for the AI runtime (0.4) to call; there is
     * no route. A space marked ai_excluded never receives one.
     */
    async attachSuggestion(commentId: string, suggestion: AiSuggestion): Promise<PageComment> {
      const row = await commentById(sql(), commentId);
      if (!row.anchor || row.parent_id) {
        throw new ValidationError('A fix belongs on an inline thread');
      }
      const [space] = await sql()<{ ai_excluded: boolean }[]>`
        select ai_excluded from spaces where id = ${row.space_id}`;
      if (space?.ai_excluded) throw new ForbiddenError('This space is excluded from AI');
      const stored: AiSuggestion = { ...suggestion, appliedAt: null, appliedBy: null };
      await sql()`
        update page_comments set ai_suggestion = ${JSON.stringify(stored)}::jsonb,
          updated_at = now()
        where id = ${commentId}`;
      await announce(deps, row.space_id, row.page_id);
      return one(commentId);
    },
  };
}
