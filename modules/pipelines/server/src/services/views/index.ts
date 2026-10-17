import type { RequestContext } from '@bemmoly/core';
import { ConflictError, NotFoundError } from '@bemmoly/shared';
import {
  SAVED_VIEWS_LIMIT,
  type CreateSavedViewBody,
  type SavedView,
  type SavedViewScreen,
  type SavedViewsResponse,
} from '../../../../shared/saved-views.ts';
import { iso } from '../../utils/time.ts';
import {
  authorizePipelines,
  requireDatabase,
  requirePerson,
  type PipelinesServiceDeps,
} from '../deps.ts';

interface ViewRow {
  id: string;
  name: string;
  screen: string;
  query: Record<string, string>;
  created_at: Date | string;
}

const toView = (row: ViewRow): SavedView => ({
  id: row.id,
  name: row.name,
  screen: row.screen as SavedViewScreen,
  query: row.query,
  createdAt: iso(row.created_at),
});

/** A person's own saved views of a list; nobody else sees or changes them. */
export function createViewsService(deps: PipelinesServiceDeps) {
  return {
    async list(ctx: RequestContext, screen: SavedViewScreen): Promise<SavedViewsResponse> {
      await authorizePipelines(ctx);
      const sql = requireDatabase(deps);
      const me = requirePerson(ctx.actor);
      const rows = await sql<ViewRow[]>`
        select id, name, screen, query, created_at from pipeline_saved_views
        where user_id = ${me}::uuid and screen = ${screen}
        order by position, created_at`;
      return { items: rows.map(toView) };
    },

    async create(ctx: RequestContext, body: CreateSavedViewBody): Promise<SavedView> {
      await authorizePipelines(ctx);
      const sql = requireDatabase(deps);
      const me = requirePerson(ctx.actor);
      const [count] = await sql<{ count: number }[]>`
        select count(*)::int as count from pipeline_saved_views
        where user_id = ${me}::uuid and screen = ${body.screen}`;
      if ((count?.count ?? 0) >= SAVED_VIEWS_LIMIT)
        throw new ConflictError(
          `You already keep ${SAVED_VIEWS_LIMIT} views here. Delete one to save another.`,
        );
      const [row] = await sql<ViewRow[]>`
        insert into pipeline_saved_views (user_id, name, screen, query, position)
        values (${me}::uuid, ${body.name}, ${body.screen}, ${JSON.stringify(body.query)}::jsonb,
          ${count?.count ?? 0})
        returning id, name, screen, query, created_at`;
      if (!row) throw new ConflictError('The view was not saved. Try again.');
      return toView(row);
    },

    async remove(ctx: RequestContext, id: string): Promise<void> {
      await authorizePipelines(ctx);
      const sql = requireDatabase(deps);
      const me = requirePerson(ctx.actor);
      const rows = await sql`
        delete from pipeline_saved_views where id = ${id}::uuid and user_id = ${me}::uuid
        returning id`;
      if (rows.length === 0) throw new NotFoundError('There is no view of yours with that id');
    },
  };
}

export type ViewsService = ReturnType<typeof createViewsService>;
