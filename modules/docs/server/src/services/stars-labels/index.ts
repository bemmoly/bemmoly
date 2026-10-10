import type { RequestContext } from '@bemmoly/core';
import { ForbiddenError } from '@bemmoly/shared';
import type {
  LabelSuggestQuery,
  LabelUsage,
  LabelsResponse,
  SetLabelsBody,
  StarResponse,
} from '../../../../shared/stars-labels.ts';
import {
  DOCS_MODULE,
  DOCS_REALTIME_KINDS,
  publishChange,
  recordAudit,
  requireDatabase,
  spaceResource,
  userIdOf,
  visibleSpaceIds,
  type DocsServiceDeps,
} from '../common.ts';
import { pageById } from '../pages/rows.ts';

/*
 * Stars are personal: anyone who can view a page can star it and only they
 * see it. Labels are shared, so replacing them needs edit; names compare
 * case-insensitively and the first spelling written is kept.
 */
export function createStarsLabelsService(deps: DocsServiceDeps) {
  const personOf = (ctx: RequestContext) => {
    const userId = userIdOf(ctx);
    if (!userId) throw new ForbiddenError('Only a person can star a page');
    return userId;
  };

  return {
    async star(ctx: RequestContext, pageId: string, starred: boolean): Promise<StarResponse> {
      const sql = requireDatabase(deps);
      const page = await pageById(sql, pageId);
      await ctx.authz.authorize(ctx.actor, 'docs.page.view', spaceResource(page.space_id));
      const userId = personOf(ctx);
      if (starred) {
        await sql`
          insert into page_stars (page_id, user_id) values (${pageId}, ${userId})
          on conflict (user_id, page_id) do nothing`;
      } else {
        await sql`delete from page_stars where page_id = ${pageId} and user_id = ${userId}`;
      }
      await deps.realtime?.publish({ kind: DOCS_REALTIME_KINDS.page, ids: [pageId], userId });
      return { starred };
    },

    async setLabels(
      ctx: RequestContext,
      pageId: string,
      body: SetLabelsBody,
    ): Promise<LabelsResponse> {
      const sql = requireDatabase(deps);
      const page = await pageById(sql, pageId);
      await ctx.authz.authorize(ctx.actor, 'docs.page.edit', spaceResource(page.space_id));
      const wanted = new Map<string, string>();
      for (const name of body.labels) {
        if (!wanted.has(name.toLowerCase())) wanted.set(name.toLowerCase(), name);
      }
      const before = await sql.begin(async (tx) => {
        const current = await tx<{ name: string }[]>`
          select name from page_labels where page_id = ${pageId} order by lower(name)`;
        await tx`
          delete from page_labels
          where page_id = ${pageId} and not (lower(name) = any(${[...wanted.keys()]}::text[]))`;
        for (const name of wanted.values()) {
          await tx`
            insert into page_labels (page_id, name, created_by)
            values (${pageId}, ${name}, ${userIdOf(ctx)}::uuid)
            on conflict (page_id, lower(name)) do nothing`;
        }
        await tx`update pages set updated_at = now() where id = ${pageId}`;
        return current.map((row) => row.name);
      });
      const after = await sql<{ name: string }[]>`
        select name from page_labels where page_id = ${pageId} order by lower(name)`;
      const labels = after.map((row) => row.name);
      await recordAudit(deps, ctx, {
        action: 'page.labels_changed',
        kind: 'page',
        id: pageId,
        before: { labels: before },
        after: { labels },
      });
      await publishChange(deps, DOCS_REALTIME_KINDS.page, page.space_id, [pageId]);
      return { labels };
    },

    /** Labels already in use in spaces the person can open, most used first. */
    async suggestLabels(ctx: RequestContext, query: LabelSuggestQuery): Promise<LabelUsage[]> {
      await ctx.authz.authorize(ctx.actor, 'docs.page.view', DOCS_MODULE);
      const sql = requireDatabase(deps);
      const visible = await visibleSpaceIds(sql, ctx);
      const rows = await sql<{ name: string; page_count: number }[]>`
        select min(l.name) as name, count(distinct l.page_id)::int as page_count
        from page_labels l join pages p on p.id = l.page_id
        where p.deleted_at is null
          and (${visible === null} or p.space_id = any(${visible ?? []}::uuid[]))
          and lower(l.name) like ${`${query.q.toLowerCase().replace(/[\\%_]/g, '\\$&')}%`}
        group by lower(l.name)
        order by page_count desc, lower(l.name)
        limit ${query.limit}`;
      return rows.map((row) => ({ name: row.name, pageCount: row.page_count }));
    },
  };
}

export type StarsLabelsService = ReturnType<typeof createStarsLabelsService>;
