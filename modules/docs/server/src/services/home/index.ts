import { decodeCursor, toPage, type RequestContext } from '@bemmoly/core';
import type { HomePages, RecentPagesQuery, StarredPagesQuery } from '../../../../shared/home.ts';
import {
  DOCS_MODULE,
  requireDatabase,
  userIdOf,
  visibleSpaceIds,
  type DocsServiceDeps,
} from '../common.ts';
import { createAttentionService } from './attention.ts';
import { HOME_COLUMNS, toHomePages, type HomeRow } from './enrich.ts';

/*
 * The Docs home's "Recent" and "Starred" lists. Recent reads the
 * (updated_at, id) index newest first; starred reads the person's stars by
 * when they starred them. Both drop pages in the trash and pages in spaces
 * the person has since left. Rows carry their ancestors, last body editor
 * and issue keys (see enrich.ts).
 */
export function createHomeService(deps: DocsServiceDeps) {
  return {
    ...createAttentionService(deps),
    async recent(ctx: RequestContext, query: RecentPagesQuery): Promise<HomePages> {
      await ctx.authz.authorize(ctx.actor, 'docs.page.view', DOCS_MODULE);
      const sql = requireDatabase(deps);
      const visible = await visibleSpaceIds(sql, ctx);
      const userId = userIdOf(ctx);
      const cursor = decodeCursor(query.cursor);
      const rows = await sql<HomeRow[]>`
        select ${sql.unsafe(HOME_COLUMNS)}
        from pages p join spaces s on s.id = p.space_id
        where p.deleted_at is null and s.archived_at is null
          and (${visible === null} or p.space_id = any(${visible ?? []}::uuid[]))
          ${query.spaceId ? sql`and p.space_id = ${query.spaceId}` : sql``}
          ${query.mine ? sql`and (p.updated_by = ${userId}::uuid or p.owner_id = ${userId}::uuid)` : sql``}
          ${cursor ? sql`and (p.updated_at, p.id) < (select updated_at, id from pages where id = ${cursor})` : sql``}
        order by p.updated_at desc, p.id desc
        limit ${query.limit + 1}`;
      const page = toPage(rows, query.limit);
      return { items: await toHomePages(deps, sql, ctx, page.rows), nextCursor: page.nextCursor };
    },

    async starred(ctx: RequestContext, query: StarredPagesQuery): Promise<HomePages> {
      await ctx.authz.authorize(ctx.actor, 'docs.page.view', DOCS_MODULE);
      const sql = requireDatabase(deps);
      const userId = userIdOf(ctx);
      if (!userId) return { items: [], nextCursor: null };
      const visible = await visibleSpaceIds(sql, ctx);
      const cursor = decodeCursor(query.cursor);
      const rows = await sql<(HomeRow & { star_id: string })[]>`
        select ${sql.unsafe(HOME_COLUMNS)}, st.id as star_id
        from page_stars st
        join pages p on p.id = st.page_id
        join spaces s on s.id = p.space_id
        where st.user_id = ${userId} and p.deleted_at is null
          and (${visible === null} or p.space_id = any(${visible ?? []}::uuid[]))
          ${cursor ? sql`and (st.created_at, st.id) < (select created_at, id from page_stars where page_id = ${cursor} and user_id = ${userId})` : sql``}
        order by st.created_at desc, st.id desc
        limit ${query.limit + 1}`;
      const page = toPage(rows, query.limit);
      return { items: await toHomePages(deps, sql, ctx, page.rows), nextCursor: page.nextCursor };
    },
  };
}

export type HomeService = ReturnType<typeof createHomeService>;
