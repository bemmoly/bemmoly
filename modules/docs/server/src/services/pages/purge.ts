import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import { TRASH_RETENTION_DAYS, type EmptyTrashResult } from '../../../../shared/pages.ts';
import {
  DOCS_REALTIME_KINDS,
  publishChange,
  recordAudit,
  requireDatabase,
  spaceResource,
  type DocsServiceDeps,
} from '../common.ts';
import { spaceByRef } from '../spaces/rows.ts';

export const DOCS_PURGE_JOB = 'docs.purge-trash';

/** A trashed subtree goes with its root: parent_id cascades to every page under it. */
async function deleteRoots(tx: SqlExecutor, spaceId: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const rows = await tx<{ id: string }[]>`
    delete from pages p
    where p.space_id = ${spaceId} and p.deleted_at is not null
      and exists (
        select 1 from pages root
        where root.id = any(${ids}::uuid[]) and root.deleted_at is not null
          and p.path like root.path || '%')
    returning p.id`;
  return rows.length;
}

/*
 * Delete forever is the one way out of the trash that can't be undone, so it
 * needs the right to configure the space: space admins and workspace admins.
 * The purge job takes the same path for pages older than the retention.
 */
export function createPurgeService(deps: DocsServiceDeps) {
  return {
    async deleteForever(ctx: RequestContext, spaceRef: string, pageId: string): Promise<void> {
      const sql = requireDatabase(deps);
      const space = await spaceByRef(sql, spaceRef);
      await ctx.authz.authorize(ctx.actor, 'docs.space.configure', spaceResource(space.id));
      await sql.begin(async (tx) => {
        const [page] = await tx<{ id: string; title: string }[]>`
          select id, title from pages
          where id = ${pageId} and space_id = ${space.id} and deleted_at is not null`;
        if (!page) throw new NotFoundError('The page is not in this space’s trash');
        await deleteRoots(tx, space.id, [page.id]);
        await recordAudit(
          deps,
          ctx,
          { action: 'page.purged', kind: 'page', id: page.id, before: { title: page.title } },
          tx,
        );
      });
      await publishChange(deps, DOCS_REALTIME_KINDS.tree, space.id, [pageId]);
    },

    async empty(ctx: RequestContext, spaceRef: string): Promise<EmptyTrashResult> {
      const sql = requireDatabase(deps);
      const space = await spaceByRef(sql, spaceRef);
      await ctx.authz.authorize(ctx.actor, 'docs.space.configure', spaceResource(space.id));
      const deleted = await sql.begin(async (tx) => {
        const rows = await tx<{ id: string }[]>`
          delete from pages where space_id = ${space.id} and deleted_at is not null
          returning id`;
        await recordAudit(
          deps,
          ctx,
          {
            action: 'space.trash_emptied',
            kind: 'space',
            id: space.id,
            after: { pages: rows.length },
          },
          tx,
        );
        return rows.length;
      });
      await publishChange(deps, DOCS_REALTIME_KINDS.tree, space.id, []);
      return { deleted };
    },

    /** Run by the purge job: every page trashed longer ago than the retention. */
    async purgeExpired(now: Date = new Date()): Promise<number> {
      const sql = requireDatabase(deps);
      const cutoff = new Date(now.getTime() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      const rows = await sql<{ id: string }[]>`
        delete from pages where deleted_at is not null and deleted_at < ${cutoff.toISOString()}::timestamptz
        returning id`;
      return rows.length;
    },
  };
}

export type PurgeService = ReturnType<typeof createPurgeService>;
