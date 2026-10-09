import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import { ForbiddenError, NotFoundError, ValidationError } from '@bemmoly/shared';
import {
  createSavedFilterBodySchema,
  type CreateSavedFilterBody,
  type ListSavedFiltersQuery,
  type SavedFilter,
  type UpdateSavedFilterBody,
} from '../../../../shared/filters.ts';
import { resolveProject, type PlanningDeps } from '../boards/context.ts';
import {
  actorUserId,
  iso,
  MODULE_RESOURCE,
  projectResource,
  requireDatabase,
} from '../issues/deps.ts';

interface FilterRow {
  id: string;
  owner_id: string;
  project_id: string | null;
  name: string;
  query: string;
  shared_with: string[];
  created_at: Date | string;
  updated_at: Date | string;
}

const COLUMNS = 'id, owner_id, project_id, name, query, shared_with, created_at, updated_at';

const toFilter = (row: FilterRow): SavedFilter => ({
  id: row.id,
  ownerId: row.owner_id,
  projectId: row.project_id,
  name: row.name,
  query: row.query,
  sharedWith: row.shared_with,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
});

/** Filters a person sees: their own, and those shared with a team they belong to. */
const visibleTo = (sql: SqlExecutor, userId: string) => sql`(f.owner_id = ${userId}
  or f.shared_with && array(select tm.team_id from team_members tm where tm.user_id = ${userId}))`;

const personOf = (ctx: RequestContext): string => {
  const userId = actorUserId(ctx);
  if (!userId) throw new ForbiddenError('Saved filters belong to a person');
  return userId;
};

/** Saved LQL filters, private to their owner or shared with teams. */
export function createFiltersService(deps: PlanningDeps) {
  /** The query must parse and validate against the fields of the filter's scope. */
  async function check(ctx: RequestContext, query: string, projectId: string | null) {
    await ctx.authz.authorize(
      ctx.actor,
      'work.issue.view',
      projectId ? projectResource(projectId) : MODULE_RESOURCE,
    );
    deps.lql.parse(query, await deps.lql.catalog(projectId));
  }

  async function checkTeams(sql: SqlExecutor, teamIds: readonly string[]) {
    if (teamIds.length === 0) return;
    const rows = await sql<
      { id: string }[]
    >`select id from teams where id = any(${teamIds}::uuid[])`;
    if (rows.length !== new Set(teamIds).size) {
      throw new ValidationError('A filter can be shared only with existing teams');
    }
  }

  async function visible(sql: SqlExecutor, id: string, userId: string): Promise<FilterRow> {
    const [row] = await sql<FilterRow[]>`
      select ${sql.unsafe(COLUMNS)} from saved_filters f
      where f.id = ${id} and ${visibleTo(sql, userId)}`;
    if (!row) throw new NotFoundError('The filter was not found');
    return row;
  }

  async function owned(sql: SqlExecutor, id: string, userId: string): Promise<FilterRow> {
    const row = await visible(sql, id, userId);
    if (row.owner_id !== userId) throw new ForbiddenError('Only the owner can change a filter');
    return row;
  }

  return {
    async list(ctx: RequestContext, query: ListSavedFiltersQuery): Promise<SavedFilter[]> {
      const sql = requireDatabase(deps);
      const userId = personOf(ctx);
      const projectId = query.projectId ? (await resolveProject(sql, query.projectId)).id : null;
      await ctx.authz.authorize(
        ctx.actor,
        'work.issue.view',
        projectId ? projectResource(projectId) : MODULE_RESOURCE,
      );
      const rows = await sql<FilterRow[]>`
        select ${sql.unsafe(COLUMNS)} from saved_filters f
        where ${visibleTo(sql, userId)}
          and (${projectId}::uuid is null or f.project_id is null or f.project_id = ${projectId}::uuid)
          and (${query.scope !== 'mine'} or f.owner_id = ${userId})
          and (${query.scope !== 'shared'} or f.owner_id <> ${userId})
        order by lower(f.name), f.id`;
      return rows.map(toFilter);
    },

    async get(ctx: RequestContext, id: string): Promise<SavedFilter> {
      return toFilter(await visible(requireDatabase(deps), id, personOf(ctx)));
    },

    async create(ctx: RequestContext, input: CreateSavedFilterBody): Promise<SavedFilter> {
      const body = createSavedFilterBodySchema.parse(input);
      const sql = requireDatabase(deps);
      const userId = personOf(ctx);
      const projectId = body.projectId ? (await resolveProject(sql, body.projectId)).id : null;
      await check(ctx, body.query, projectId);
      await checkTeams(sql, body.sharedWith);
      const [row] = await sql<FilterRow[]>`
        insert into saved_filters (owner_id, project_id, name, query, shared_with)
        values (${userId}, ${projectId}, ${body.name}, ${body.query},
          ${[...new Set(body.sharedWith)]}::uuid[])
        returning ${sql.unsafe(COLUMNS)}`;
      return toFilter(row as FilterRow);
    },

    async update(
      ctx: RequestContext,
      id: string,
      body: UpdateSavedFilterBody,
    ): Promise<SavedFilter> {
      const sql = requireDatabase(deps);
      const current = await owned(sql, id, personOf(ctx));
      const projectId =
        body.projectId === undefined
          ? current.project_id
          : body.projectId && (await resolveProject(sql, body.projectId)).id;
      await check(ctx, body.query ?? current.query, projectId ?? null);
      if (body.sharedWith) await checkTeams(sql, body.sharedWith);
      const sharedWith = body.sharedWith ? [...new Set(body.sharedWith)] : current.shared_with;
      const [row] = await sql<FilterRow[]>`
        update saved_filters set name = ${body.name ?? current.name},
          query = ${body.query ?? current.query}, project_id = ${projectId ?? null},
          shared_with = ${sharedWith}::uuid[], updated_at = now()
        where id = ${id}
        returning ${sql.unsafe(COLUMNS)}`;
      return toFilter(row as FilterRow);
    },

    async remove(ctx: RequestContext, id: string): Promise<void> {
      const sql = requireDatabase(deps);
      await owned(sql, id, personOf(ctx));
      await sql`delete from saved_filters where id = ${id}`;
    },
  };
}

export type FiltersService = ReturnType<typeof createFiltersService>;
