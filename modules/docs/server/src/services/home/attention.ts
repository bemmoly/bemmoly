import type { RequestContext } from '@bemmoly/core';
import type { AttentionQuery, AttentionResponse } from '../../../../shared/attention.ts';
import {
  DOCS_MODULE,
  iso,
  requireDatabase,
  userIdOf,
  visibleSpaceIds,
  type DocsServiceDeps,
} from '../common.ts';
import { SUMMARY_COLUMNS, toSummary, type PageRow } from '../pages/rows.ts';

const DEFAULT_STALE_AFTER_DAYS = 90;

/**
 * "Needs attention" on the Docs home: reviews the person was asked for, oldest
 * request first, then published pages they own whose body has not changed in
 * docs.staleAfterDays, longest untouched first. Both keep to spaces the
 * person can still open and drop pages in the trash.
 */
export function createAttentionService(deps: Pick<DocsServiceDeps, 'database' | 'settings'>) {
  return {
    async attention(ctx: RequestContext, query: AttentionQuery): Promise<AttentionResponse> {
      await ctx.authz.authorize(ctx.actor, 'docs.page.view', DOCS_MODULE);
      const staleAfterDays =
        (await deps.settings?.get('docs.staleAfterDays')) ?? DEFAULT_STALE_AFTER_DAYS;
      const userId = userIdOf(ctx);
      if (!userId) return { items: [], staleAfterDays };
      const sql = requireDatabase(deps);
      const visible = await visibleSpaceIds(sql, ctx);
      const inSpaces = () => sql`p.deleted_at is null and s.archived_at is null
        and (${visible === null} or p.space_id = any(${visible ?? []}::uuid[]))`;
      const reviews = await sql<PageRow[]>`
        select ${sql.unsafe(SUMMARY_COLUMNS)}
        from pages p join spaces s on s.id = p.space_id
        where ${inSpaces()} and p.status = 'in_review' and ${userId}::uuid = any(p.reviewers)
        order by p.updated_at asc, p.id
        limit ${query.limit}`;
      const stale = await sql<PageRow[]>`
        select ${sql.unsafe(SUMMARY_COLUMNS)}
        from pages p join spaces s on s.id = p.space_id
        where ${inSpaces()} and p.status = 'published' and p.owner_id = ${userId}::uuid
          and p.content_updated_at < now() - make_interval(days => ${staleAfterDays}::int)
        order by p.content_updated_at asc, p.id
        limit ${Math.max(query.limit - reviews.length, 0)}`;
      return {
        items: [
          ...reviews.map((row) => ({
            kind: 'review' as const,
            page: toSummary(row),
            since: iso(row.updated_at),
          })),
          ...stale.map((row) => ({
            kind: 'stale' as const,
            page: toSummary(row),
            since: iso(row.content_updated_at),
          })),
        ],
        staleAfterDays,
      };
    },
  };
}

export type AttentionService = ReturnType<typeof createAttentionService>;
