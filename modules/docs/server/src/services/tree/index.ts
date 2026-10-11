import { decodeCursor, toPage, type RequestContext } from '@bemmoly/core';
import { ConflictError, NotFoundError } from '@bemmoly/shared';
import type { MovePageBody, MoveResult, TreePage, TreeQuery } from '../../../../shared/tree.ts';
import {
  DOCS_REALTIME_KINDS,
  publishChange,
  recordAudit,
  requireDatabase,
  spaceResource,
  userIdOf,
  type DocsServiceDeps,
} from '../common.ts';
import { rankAmongSiblings } from '../pages/rank.ts';
import { pageById, SUMMARY_COLUMNS, toSummary, type PageRow } from '../pages/rows.ts';
import { spaceByRef } from '../spaces/rows.ts';

/*
 * The tree reads one level at a time on the (space_id, parent_id, position,
 * id) index. A move rewrites the moved page's path prefix on its whole
 * subtree in one statement, so a subtree query stays a prefix scan.
 */
export function createTreeService(deps: DocsServiceDeps) {
  return {
    async children(ctx: RequestContext, spaceRef: string, query: TreeQuery): Promise<TreePage> {
      const sql = requireDatabase(deps);
      const space = await spaceByRef(sql, spaceRef);
      await ctx.authz.authorize(ctx.actor, 'docs.page.view', spaceResource(space.id));
      const cursor = decodeCursor(query.cursor);
      const parentId = query.parentId ?? null;
      const rows = await sql<PageRow[]>`
        select ${sql.unsafe(SUMMARY_COLUMNS)}
        from pages p join spaces s on s.id = p.space_id
        where p.space_id = ${space.id}
          and p.parent_id is not distinct from ${parentId}::uuid
          and p.deleted_at is null
          ${cursor ? sql`and (p.position, p.id) > (select position, id from pages where id = ${cursor})` : sql``}
        order by p.position, p.id
        limit ${query.limit + 1}`;
      const page = toPage(rows, query.limit);
      return { items: page.rows.map(toSummary), nextCursor: page.nextCursor };
    },

    /**
     * Under a new parent (or the root, or into another space) between two
     * siblings. Moving a page into its own subtree would make a cycle, so it
     * is refused; moving across spaces needs edit in both.
     */
    async move(ctx: RequestContext, id: string, body: MovePageBody): Promise<MoveResult> {
      const sql = requireDatabase(deps);
      const page = await pageById(sql, id);
      const targetSpaceId = body.spaceId ?? page.space_id;
      await ctx.authz.authorize(ctx.actor, 'docs.page.edit', spaceResource(page.space_id));
      if (targetSpaceId !== page.space_id) {
        await ctx.authz.authorize(ctx.actor, 'docs.page.edit', spaceResource(targetSpaceId));
      }
      const result = await sql.begin(async (tx) => {
        const locked = await pageById(tx, id, { lock: true });
        let parentPath = '/';
        if (body.parentId) {
          if (body.parentId === id) throw new ConflictError('A page cannot be its own parent');
          const parent = await pageById(tx, body.parentId);
          if (parent.space_id !== targetSpaceId) {
            throw new ConflictError('The new parent is in another space');
          }
          if (parent.path.startsWith(locked.path)) {
            throw new ConflictError('A page cannot move under one of its own subpages');
          }
          parentPath = parent.path;
        } else {
          const [space] = await tx`select id from spaces where id = ${targetSpaceId}`;
          if (!space) throw new NotFoundError('The space was not found');
        }
        const position = await rankAmongSiblings(tx, {
          spaceId: targetSpaceId,
          parentId: body.parentId,
          afterId: body.afterId,
          beforeId: body.beforeId,
          excludeId: id,
        });
        const newPath = `${parentPath}${id}/`;
        const moved = await tx<{ id: string }[]>`
          update pages set
            path = ${newPath} || substr(path, ${locked.path.length + 1}),
            space_id = ${targetSpaceId},
            updated_at = now()
          where space_id = ${locked.space_id} and path like ${locked.path} || '%'
          returning id`;
        await tx`
          update pages set parent_id = ${body.parentId}::uuid, position = ${position},
            updated_by = ${userIdOf(ctx)}::uuid, version = version + 1
          where id = ${id}`;
        const after = await pageById(tx, id);
        await recordAudit(
          deps,
          ctx,
          {
            action: 'page.moved',
            kind: 'page',
            id,
            before: toSummary(locked),
            after: toSummary(after),
          },
          tx,
        );
        return { after, ids: moved.map((row) => row.id) };
      });
      await publishChange(deps, DOCS_REALTIME_KINDS.tree, page.space_id, result.ids);
      if (targetSpaceId !== page.space_id) {
        await publishChange(deps, DOCS_REALTIME_KINDS.tree, targetSpaceId, result.ids);
      }
      return { page: toSummary(result.after), movedCount: result.ids.length };
    },
  };
}

export type TreeService = ReturnType<typeof createTreeService>;
