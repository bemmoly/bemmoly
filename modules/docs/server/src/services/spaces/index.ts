import { decodeCursor, toPage, type RequestContext, type SqlExecutor } from '@bemmoly/core';
import { ConflictError, NotFoundError, ProviderError } from '@bemmoly/shared';
import type {
  CreateSpaceBody,
  ListSpacesQuery,
  Space,
  SpacesPage,
  UpdateSpaceBody,
} from '../../../../shared/spaces.ts';
import {
  DOCS_MODULE,
  DOCS_REALTIME_KINDS,
  publishChange,
  recordAudit,
  requireDatabase,
  spaceResource,
  UNIQUE_VIOLATION,
  userIdOf,
  visibleSpaceIds,
  type DocsServiceDeps,
} from '../common.ts';
import { SPACE_COLUMNS, spaceByRef, toSpace, type SpaceRow } from './rows.ts';

/** The role a space's creator gets; spaces reuse the container admin system role. */
const SPACE_ADMIN_ROLE_KEY = 'project_admin';

/** A new space's first members: its creator as admin, and the owning team. */
async function joinAsCreator(
  deps: DocsServiceDeps,
  ctx: RequestContext,
  tx: SqlExecutor,
  space: { id: string; team_id: string | null },
): Promise<void> {
  const memberships = deps.memberships;
  if (!memberships) return;
  const creator = userIdOf(ctx);
  if (creator) {
    const roles = await memberships.roles(tx);
    const admin = roles.find((role) => role.key === SPACE_ADMIN_ROLE_KEY);
    const input = { userIds: [creator], ...(admin ? { roleId: admin.id } : {}) };
    await memberships.add('space', space.id, input, tx);
  }
  if (space.team_id) await memberships.add('space', space.id, { teamIds: [space.team_id] }, tx);
}

/** Spaces as the Docs home lists them and the space settings configure them. */
export function createSpacesService(deps: DocsServiceDeps) {
  const reread = async (sql: SqlExecutor, id: string) => toSpace(await spaceByRef(sql, id));

  return {
    async list(ctx: RequestContext, query: ListSpacesQuery): Promise<SpacesPage> {
      await ctx.authz.authorize(ctx.actor, 'docs.page.view', DOCS_MODULE);
      const sql = requireDatabase(deps);
      const cursor = decodeCursor(query.cursor);
      const visible = await visibleSpaceIds(sql, ctx);
      const rows = await sql<SpaceRow[]>`
        select ${sql.unsafe(SPACE_COLUMNS)} from spaces s
        where (${query.archived} or s.archived_at is null)
          and (${query.teamId ?? null}::uuid is null or s.team_id = ${query.teamId ?? null})
          and (${visible === null} or s.id = any(${visible ?? []}::uuid[]))
          ${cursor ? sql`and s.id > ${cursor}` : sql``}
        order by s.id
        limit ${query.limit + 1}`;
      const page = toPage(rows, query.limit);
      return { items: page.rows.map(toSpace), nextCursor: page.nextCursor };
    },

    async get(ctx: RequestContext, ref: string): Promise<Space> {
      const space = await spaceByRef(requireDatabase(deps), ref);
      await ctx.authz.authorize(ctx.actor, 'docs.page.view', spaceResource(space.id));
      return toSpace(space);
    },

    async create(ctx: RequestContext, body: CreateSpaceBody): Promise<Space> {
      await ctx.authz.authorize(ctx.actor, 'docs.space.create', DOCS_MODULE);
      const sql = requireDatabase(deps);
      const key = body.key.trim().toUpperCase();
      try {
        const space = await sql.begin(async (tx) => {
          const [created] = await tx<{ id: string; team_id: string | null }[]>`
            insert into spaces (key, name, description, icon, color, team_id, project_id,
              ai_excluded, created_by)
            values (${key}, ${body.name}, ${body.description ?? null}, ${body.icon ?? null},
              ${body.color ?? null}, ${body.teamId ?? null}::uuid, ${body.projectId ?? null}::uuid,
              ${body.aiExcluded ?? false}, ${userIdOf(ctx)}::uuid)
            returning id, team_id`;
          if (!created) throw new ProviderError('The space was not stored');
          await joinAsCreator(deps, ctx, tx, created);
          const after = await reread(tx, created.id);
          await recordAudit(
            deps,
            ctx,
            { action: 'space.created', kind: 'space', id: after.id, after },
            tx,
          );
          return after;
        });
        await publishChange(deps, DOCS_REALTIME_KINDS.space, space.id, [space.id]);
        return space;
      } catch (error) {
        if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
          throw new ConflictError(`A space with the key ${key} already exists`);
        }
        throw error;
      }
    },

    async update(ctx: RequestContext, ref: string, patch: UpdateSpaceBody): Promise<Space> {
      const sql = requireDatabase(deps);
      const before = await spaceByRef(sql, ref);
      await ctx.authz.authorize(ctx.actor, 'docs.space.configure', spaceResource(before.id));
      if (patch.homePageId) {
        const [home] = await sql`
          select 1 from pages where id = ${patch.homePageId} and space_id = ${before.id}
            and deleted_at is null`;
        if (!home) throw new NotFoundError('The home page must be a live page in this space');
      }
      const has = (field: keyof UpdateSpaceBody) => patch[field] !== undefined;
      await sql`
        update spaces set
          name = coalesce(${patch.name ?? null}, name),
          description = case when ${has('description')} then ${patch.description ?? null} else description end,
          icon = case when ${has('icon')} then ${patch.icon ?? null} else icon end,
          color = case when ${has('color')} then ${patch.color ?? null} else color end,
          team_id = case when ${has('teamId')} then ${patch.teamId ?? null}::uuid else team_id end,
          ai_excluded = coalesce(${patch.aiExcluded ?? null}, ai_excluded),
          home_page_id = case when ${has('homePageId')} then ${patch.homePageId ?? null}::uuid else home_page_id end,
          archived_at = case when ${has('archived')}
            then (case when ${patch.archived ?? false} then coalesce(archived_at, now()) else null end)
            else archived_at end,
          updated_at = now()
        where id = ${before.id}`;
      const after = await reread(sql, before.id);
      const prior = toSpace(before);
      await recordAudit(deps, ctx, {
        action: 'space.updated',
        kind: 'space',
        id: after.id,
        before: prior,
        after,
      });
      await publishChange(deps, DOCS_REALTIME_KINDS.space, after.id, [after.id]);
      return after;
    },

    /** Only an archived space can go, so a slip is two steps away from losing every page in it. */
    async remove(ctx: RequestContext, ref: string): Promise<void> {
      const sql = requireDatabase(deps);
      const space = await spaceByRef(sql, ref);
      await ctx.authz.authorize(ctx.actor, 'docs.space.configure', spaceResource(space.id));
      if (!space.archived_at) throw new ConflictError('Archive the space before deleting it');
      await sql`delete from spaces where id = ${space.id}`;
      const before = toSpace(space);
      await recordAudit(deps, ctx, {
        action: 'space.deleted',
        kind: 'space',
        id: space.id,
        before,
      });
      await publishChange(deps, DOCS_REALTIME_KINDS.space, space.id, [space.id]);
    },
  };
}

export type SpacesService = ReturnType<typeof createSpacesService>;
