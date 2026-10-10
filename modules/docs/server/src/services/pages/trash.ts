import { decodeCursor, toPage, type RequestContext } from '@bemmoly/core';
import type { ListTrashQuery, PageDetail, TrashPage } from '../../../../shared/pages.ts';
import {
  DOCS_REALTIME_KINDS,
  publishChange,
  recordAudit,
  requireDatabase,
  spaceResource,
  userIdOf,
  type DocsServiceDeps,
} from '../common.ts';
import { spaceByRef } from '../spaces/rows.ts';
import { loadDetail } from './detail.ts';
import { rankAmongSiblings } from './rank.ts';
import { pageById, SUMMARY_COLUMNS, toSummary, type PageRow } from './rows.ts';

interface TrashRow extends PageRow {
  deleted_by_id: string | null;
  deleted_by_name: string | null;
  was_in_id: string | null;
  was_in_title: string | null;
  was_in_icon: string | null;
  pages_inside: number;
}

const toTrashItem = (row: TrashRow) => ({
  ...toSummary(row),
  deletedBy: row.deleted_by_id ? { id: row.deleted_by_id, name: row.deleted_by_name ?? '' } : null,
  wasIn: row.was_in_id
    ? { id: row.was_in_id, title: row.was_in_title ?? '', icon: row.was_in_icon }
    : null,
  pagesInside: row.pages_inside,
});

/*
 * Delete is soft: the page and every live page under it get one deleted_at,
 * so restoring the page brings back exactly what went with it and not the
 * children deleted on their own before. A page whose parent is still in the
 * trash comes back at the root of its space, at the end.
 */
export function createTrashService(deps: DocsServiceDeps) {
  return {
    async remove(ctx: RequestContext, id: string): Promise<void> {
      const sql = requireDatabase(deps);
      const page = await pageById(sql, id);
      await ctx.authz.authorize(ctx.actor, 'docs.page.delete', spaceResource(page.space_id));
      const userId = userIdOf(ctx);
      const removed = await sql.begin(async (tx) => {
        const rows = await tx<{ id: string }[]>`
          update pages set deleted_at = now(), deleted_by = ${userId}::uuid, updated_at = now()
          where space_id = ${page.space_id} and deleted_at is null
            and path like ${page.path} || '%'
          returning id`;
        await tx`
          update spaces set home_page_id = null
          where id = ${page.space_id} and home_page_id = any(${rows.map((row) => row.id)}::uuid[])`;
        await recordAudit(
          deps,
          ctx,
          { action: 'page.deleted', kind: 'page', id, before: toSummary(page) },
          tx,
        );
        return rows.map((row) => row.id);
      });
      await publishChange(deps, DOCS_REALTIME_KINDS.tree, page.space_id, removed);
    },

    async restore(ctx: RequestContext, id: string): Promise<PageDetail> {
      const sql = requireDatabase(deps);
      const page = await pageById(sql, id, { deleted: true });
      await ctx.authz.authorize(ctx.actor, 'docs.page.delete', spaceResource(page.space_id));
      if (!page.deleted_at) return loadDetail(sql, page, userIdOf(ctx));
      const restored = await sql.begin(async (tx) => {
        const [parent] = page.parent_id
          ? await tx<{ deleted_at: Date | null }[]>`
              select deleted_at from pages where id = ${page.parent_id}`
          : [];
        const orphaned = Boolean(page.parent_id) && (!parent || parent.deleted_at !== null);
        const rows = await tx<{ id: string }[]>`
          update pages set deleted_at = null, deleted_by = null, updated_at = now()
          where space_id = ${page.space_id}
            and deleted_at = (select deleted_at from pages where id = ${page.id})
            and path like ${page.path} || '%'
          returning id`;
        if (orphaned) {
          const position = await rankAmongSiblings(tx, {
            spaceId: page.space_id,
            parentId: null,
            excludeId: page.id,
          });
          const rootPath = `/${page.id}/`;
          await tx`
            update pages set path = ${rootPath} || substr(path, ${page.path.length + 1})
            where space_id = ${page.space_id} and path like ${page.path} || '%'`;
          await tx`update pages set parent_id = null, position = ${position} where id = ${page.id}`;
        }
        const after = await pageById(tx, page.id);
        await recordAudit(
          deps,
          ctx,
          { action: 'page.restored', kind: 'page', id, after: toSummary(after) },
          tx,
        );
        return { after, ids: rows.map((row) => row.id) };
      });
      await publishChange(deps, DOCS_REALTIME_KINDS.tree, page.space_id, restored.ids);
      return loadDetail(sql, restored.after, userIdOf(ctx));
    },

    /** The space's trash: only the pages deleted on their own, newest first. */
    async list(ctx: RequestContext, spaceRef: string, query: ListTrashQuery): Promise<TrashPage> {
      const sql = requireDatabase(deps);
      const space = await spaceByRef(sql, spaceRef);
      await ctx.authz.authorize(ctx.actor, 'docs.page.delete', spaceResource(space.id));
      const cursor = decodeCursor(query.cursor);
      const rows = await sql<TrashRow[]>`
        select ${sql.unsafe(SUMMARY_COLUMNS)},
          u.id as deleted_by_id, u.name as deleted_by_name,
          up.id as was_in_id, up.title as was_in_title, up.icon as was_in_icon,
          (select count(*)::int from pages d
            where d.path like p.path || '%' and d.id <> p.id
              and d.deleted_at = p.deleted_at) as pages_inside
        from pages p join spaces s on s.id = p.space_id
          left join users u on u.id = p.deleted_by
          left join pages up on up.id = p.parent_id
        where p.space_id = ${space.id} and p.deleted_at is not null
          and not exists (
            select 1 from pages up where up.id = p.parent_id and up.deleted_at = p.deleted_at)
          ${cursor ? sql`and (p.deleted_at, p.id) < (select deleted_at, id from pages where id = ${cursor})` : sql``}
        order by p.deleted_at desc, p.id desc
        limit ${query.limit + 1}`;
      const page = toPage(rows, query.limit);
      return { items: page.rows.map(toTrashItem), nextCursor: page.nextCursor };
    },
  };
}
