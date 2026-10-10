import type { RequestContext } from '@bemmoly/core';
import { ConflictError, ValidationError } from '@bemmoly/shared';
import type { PageDetail } from '../../../../shared/pages.ts';
import {
  canTransition,
  PUBLISHING_STATUSES,
  type SetReviewersBody,
  type SetStatusBody,
} from '../../../../shared/status.ts';
import {
  DOCS_REALTIME_KINDS,
  publishChange,
  recordAudit,
  requireDatabase,
  spaceResource,
  userIdOf,
  type DocsServiceDeps,
} from '../common.ts';
import { loadDetail } from '../pages/detail.ts';
import { pageById } from '../pages/rows.ts';
import { insertRevision } from '../revisions/write.ts';
import { eligibleReviewers } from '../spaces/eligibility.ts';

/*
 * The review flow: draft, in review, published, archived. Entering published
 * or archived needs docs.page.publish; the rest needs docs.page.edit.
 * Publishing writes a "publish" revision, so the history marks each release.
 * Reviewers must be able to open the space's pages (members, and org admins,
 * whom authorization lets into every space), so a review request never names
 * someone who cannot open the page; GET .../members marks the same people.
 */
export function createStatusService(deps: DocsServiceDeps) {
  return {
    async setStatus(ctx: RequestContext, id: string, body: SetStatusBody): Promise<PageDetail> {
      const sql = requireDatabase(deps);
      const page = await pageById(sql, id);
      const capability = PUBLISHING_STATUSES.includes(body.status)
        ? 'docs.page.publish'
        : 'docs.page.edit';
      await ctx.authz.authorize(ctx.actor, capability, spaceResource(page.space_id));
      if (!canTransition(page.status, body.status)) {
        throw new ConflictError(`A ${page.status} page cannot become ${body.status}`);
      }
      if (body.status === 'in_review' && page.reviewers.length === 0) {
        throw new ValidationError('Add a reviewer before asking for a review');
      }
      await sql.begin(async (tx) => {
        await tx`
          update pages set
            status = ${body.status},
            published_at = case when ${body.status === 'published'} then now() else published_at end,
            version = version + 1,
            updated_by = ${userIdOf(ctx)}::uuid,
            updated_at = now()
          where id = ${id}`;
        if (body.status === 'published') {
          await insertRevision(tx, { pageId: id, kind: 'publish', createdBy: userIdOf(ctx) });
        }
      });
      const after = await pageById(sql, id);
      await recordAudit(deps, ctx, {
        action: 'page.status_changed',
        kind: 'page',
        id,
        before: { status: page.status },
        after: { status: after.status, ...(body.note ? { note: body.note } : {}) },
      });
      await publishChange(deps, DOCS_REALTIME_KINDS.page, page.space_id, [id]);
      await publishChange(deps, DOCS_REALTIME_KINDS.tree, page.space_id, [id]);
      if (body.status === 'published') {
        await publishChange(deps, DOCS_REALTIME_KINDS.revisions, page.space_id, [id]);
      }
      return loadDetail(sql, after, userIdOf(ctx));
    },

    async setReviewers(
      ctx: RequestContext,
      id: string,
      body: SetReviewersBody,
    ): Promise<PageDetail> {
      const sql = requireDatabase(deps);
      const page = await pageById(sql, id);
      await ctx.authz.authorize(ctx.actor, 'docs.page.edit', spaceResource(page.space_id));
      const reviewers = [...new Set(body.reviewers)];
      if (reviewers.length > 0) {
        const known = await eligibleReviewers(ctx, sql, page.space_id, reviewers);
        const missing = reviewers.filter((userId) => !known.has(userId));
        if (missing.length > 0) {
          throw new ValidationError('Reviewers must be active members of the space', {
            details: { userIds: missing },
          });
        }
      }
      await sql`
        update pages set reviewers = ${reviewers}::uuid[], version = version + 1,
          updated_by = ${userIdOf(ctx)}::uuid, updated_at = now()
        where id = ${id}`;
      const after = await pageById(sql, id);
      await recordAudit(deps, ctx, {
        action: 'page.reviewers_changed',
        kind: 'page',
        id,
        before: { reviewers: page.reviewers },
        after: { reviewers },
      });
      await publishChange(deps, DOCS_REALTIME_KINDS.page, page.space_id, [id]);
      return loadDetail(sql, after, userIdOf(ctx));
    },
  };
}

export type StatusService = ReturnType<typeof createStatusService>;
