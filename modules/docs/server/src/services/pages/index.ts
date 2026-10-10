import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import { plainText, wordCount } from '@bemmoly/editor/convert';
import { ConflictError, NotFoundError, ProviderError } from '@bemmoly/shared';
import type { RichText } from '../../../../shared/common.ts';
import type { CreatePageBody, PageDetail, UpdatePageBody } from '../../../../shared/pages.ts';
import {
  DOCS_REALTIME_KINDS,
  publishChange,
  recordAudit,
  requireDatabase,
  spaceResource,
  userIdOf,
  type DocsServiceDeps,
} from '../common.ts';
import type { PageCollab } from '../collab/index.ts';
import { bodyEdges, rewriteBodyLinks } from '../links/rewrite.ts';
import { loadDetail } from './detail.ts';
import { rankAmongSiblings } from './rank.ts';
import { pageById, toSummary } from './rows.ts';
import { createTrashService } from './trash.ts';

/** The snapshot a new page starts from: the body's, the template's, or none. */
async function startingSnapshot(sql: SqlExecutor, body: CreatePageBody): Promise<RichText | null> {
  if (body.snapshot) return body.snapshot;
  if (!body.templateId) return null;
  const [template] = await sql<{ snapshot: RichText }[]>`
    select snapshot from templates
    where id = ${body.templateId} and archived_at is null
      and (space_id is null or space_id = ${body.spaceId})`;
  if (!template) throw new NotFoundError('The template was not found in this space');
  return template.snapshot;
}

/** Pages: create, open, rename and edit, and the trash (in trash.ts). */
export function createPagesService(deps: DocsServiceDeps, collab: PageCollab) {
  const trash = createTrashService(deps);

  return {
    async create(ctx: RequestContext, body: CreatePageBody): Promise<PageDetail> {
      const sql = requireDatabase(deps);
      await ctx.authz.authorize(ctx.actor, 'docs.page.edit', spaceResource(body.spaceId));
      const userId = userIdOf(ctx);
      const id = await sql.begin(async (tx) => {
        const [space] = await tx`select id from spaces where id = ${body.spaceId} for update`;
        if (!space) throw new NotFoundError('The space was not found');
        let parentPath = '/';
        if (body.parentId) {
          const parent = await pageById(tx, body.parentId);
          if (parent.space_id !== body.spaceId) {
            throw new ConflictError('The parent page is in another space');
          }
          parentPath = parent.path;
        }
        const position = await rankAmongSiblings(tx, {
          spaceId: body.spaceId,
          parentId: body.parentId ?? null,
          afterId: body.afterId,
          beforeId: body.beforeId,
        });
        const snapshot = await startingSnapshot(tx, body);
        const readable = snapshot as Parameters<typeof plainText>[0];
        const text = plainText(readable);
        const [created] = await tx<{ id: string }[]>`
          insert into pages (id, space_id, parent_id, position, path, title, icon, owner_id,
            template_id, snapshot, text, word_count, created_by, updated_by)
          select g.id, ${body.spaceId}, ${body.parentId ?? null}::uuid, ${position},
            ${parentPath} || g.id::text || '/', ${body.title ?? ''}, ${body.icon ?? null},
            ${userId}::uuid, ${body.templateId ?? null}::uuid,
            ${snapshot ? JSON.stringify(snapshot) : null}::jsonb, ${text}, ${wordCount(readable)},
            ${userId}::uuid, ${userId}::uuid
          from (select uuidv7() as id) g
          returning id`;
        if (!created) throw new ProviderError('The page was not stored');
        const after = toSummary(await pageById(tx, created.id));
        await recordAudit(
          deps,
          ctx,
          { action: 'page.created', kind: 'page', id: created.id, after },
          tx,
        );
        return created.id;
      });
      const row = await pageById(sql, id);
      if (row.snapshot) {
        const edges = await bodyEdges(deps, row.snapshot, id);
        await rewriteBodyLinks(sql, id, edges, userId);
      }
      await publishChange(deps, DOCS_REALTIME_KINDS.tree, row.space_id, [id]);
      return loadDetail(sql, row, userId);
    },

    async get(ctx: RequestContext, id: string, options: { deleted?: boolean } = {}) {
      const sql = requireDatabase(deps);
      const row = await pageById(sql, id, { deleted: Boolean(options.deleted) });
      await ctx.authz.authorize(ctx.actor, 'docs.page.view', spaceResource(row.space_id));
      return loadDetail(sql, row, userIdOf(ctx));
    },

    /**
     * Title, icon and owner. A version that no longer matches is a conflict, so
     * two tabs never overwrite each other's rename silently. The body belongs to
     * the collab server now; a snapshot sent here (the 0.2 shape, accepted until
     * 0.4) is applied through it as one edit, so open editors see it.
     */
    async update(ctx: RequestContext, id: string, patch: UpdatePageBody): Promise<PageDetail> {
      const sql = requireDatabase(deps);
      const userId = userIdOf(ctx);
      const before = await pageById(sql, id);
      await ctx.authz.authorize(ctx.actor, 'docs.page.edit', spaceResource(before.space_id));
      const has = (field: keyof UpdatePageBody) => patch[field] !== undefined;
      if (patch.snapshot) {
        if (patch.version !== undefined && patch.version !== before.version) {
          throw new ConflictError('The page changed since you opened it; reload it');
        }
        await collab.replaceContent(id, patch.snapshot, ctx.actor);
      }
      const [updated] = await sql<{ id: string }[]>`
        update pages set
          title = coalesce(${patch.title ?? null}, title),
          icon = case when ${has('icon')} then ${patch.icon ?? null} else icon end,
          owner_id = case when ${has('ownerId')} then ${patch.ownerId ?? null}::uuid else owner_id end,
          version = version + 1,
          updated_by = ${userId}::uuid,
          updated_at = now()
        where id = ${id} and deleted_at is null
          and (${patch.version ?? null}::integer is null or version = ${patch.version ?? null})
        returning id`;
      if (!updated) throw new ConflictError('The page changed since you opened it; reload it');
      const row = await pageById(sql, id);
      await recordAudit(deps, ctx, {
        action: 'page.updated',
        kind: 'page',
        id,
        before: toSummary(before),
        after: toSummary(row),
      });
      await publishChange(deps, DOCS_REALTIME_KINDS.page, row.space_id, [id]);
      if (patch.title !== undefined || has('icon')) {
        await publishChange(deps, DOCS_REALTIME_KINDS.tree, row.space_id, [id]);
      }
      return loadDetail(sql, row, userId);
    },

    remove: trash.remove,
    restore: trash.restore,
    listTrash: trash.list,
  };
}

export type PagesService = ReturnType<typeof createPagesService>;
