import { decodeCursor, toPage, type RequestContext, type SqlExecutor } from '@bemmoly/core';
import { ProviderError, ValidationError } from '@bemmoly/shared';
import type {
  Component,
  ComponentsPage,
  CreateComponentBody,
  ListComponentsQuery,
  UpdateComponentBody,
} from '../../../../shared/versions-components.ts';
import {
  authorizedProject,
  iso,
  namePage,
  notFound,
  recordChange,
  requireDatabase,
  storing,
  type CatalogDeps,
} from '../labels/catalog.ts';

interface ComponentRow {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  lead_user_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const COLUMNS = 'id, project_id, name, description, lead_user_id, created_at, updated_at';

const toComponent = (row: ComponentRow): Component => ({
  id: row.id,
  projectId: row.project_id,
  name: row.name,
  description: row.description,
  leadUserId: row.lead_user_id,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
});

/** A lead is someone who can still sign in; a deactivated person leads nothing new. */
async function assertActiveLead(sql: SqlExecutor, userId: string | null | undefined) {
  if (!userId) return;
  const [row] = await sql<{ id: string }[]>`
    select id from users where id = ${userId} and status = 'active'`;
  if (!row) throw new ValidationError('The component lead must be an active person');
}

/** A project's components, each with an optional lead the issue page names. */
export function createComponentsService(deps: CatalogDeps) {
  const change = (action: string, row: ComponentRow) =>
    ({ action, kind: 'component', id: row.id, projectId: row.project_id }) as const;

  async function existing(projectId: string, id: string): Promise<ComponentRow> {
    const sql = requireDatabase(deps);
    const [row] = await sql<ComponentRow[]>`
      select ${sql.unsafe(COLUMNS)} from components
      where id = ${id} and project_id = ${projectId}`;
    return row ?? notFound('component');
  }

  return {
    async list(
      ctx: RequestContext,
      key: string,
      query: ListComponentsQuery,
    ): Promise<ComponentsPage> {
      const sql = requireDatabase(deps);
      const project = await authorizedProject(ctx, sql, key, 'work.issue.view');
      const rows = await sql<ComponentRow[]>`
        select ${sql.unsafe(COLUMNS)} from components
        where project_id = ${project.id}
          ${namePage(sql, 'components', query.q, decodeCursor(query.cursor))}
        order by lower(name), id
        limit ${query.limit + 1}`;
      const page = toPage(rows, query.limit);
      return { items: page.rows.map(toComponent), nextCursor: page.nextCursor };
    },

    async create(ctx: RequestContext, key: string, body: CreateComponentBody): Promise<Component> {
      const sql = requireDatabase(deps);
      const project = await authorizedProject(ctx, sql, key, 'work.project.configure');
      await assertActiveLead(sql, body.leadUserId);
      const [row] = await storing(
        'component',
        body.name,
        () =>
          sql<ComponentRow[]>`
          insert into components (project_id, name, description, lead_user_id)
          values (${project.id}, ${body.name}, ${body.description ?? null},
            ${body.leadUserId ?? null}::uuid)
          returning ${sql.unsafe(COLUMNS)}`,
      );
      if (!row) throw new ProviderError('The component was not stored');
      await recordChange(deps, ctx, change('component.created', row), undefined, toComponent(row));
      return toComponent(row);
    },

    async update(
      ctx: RequestContext,
      key: string,
      id: string,
      body: UpdateComponentBody,
    ): Promise<Component> {
      const sql = requireDatabase(deps);
      const project = await authorizedProject(ctx, sql, key, 'work.project.configure');
      const before = await existing(project.id, id);
      await assertActiveLead(sql, body.leadUserId);
      const [row] = await storing(
        'component',
        body.name,
        () =>
          sql<ComponentRow[]>`
          update components set
            name = coalesce(${body.name ?? null}, name),
            description = case when ${body.description !== undefined}
              then ${body.description ?? null} else description end,
            lead_user_id = case when ${body.leadUserId !== undefined}
              then ${body.leadUserId ?? null}::uuid else lead_user_id end,
            updated_at = now()
          where id = ${before.id}
          returning ${sql.unsafe(COLUMNS)}`,
      );
      if (!row) return notFound('component');
      await recordChange(
        deps,
        ctx,
        change('component.updated', row),
        toComponent(before),
        toComponent(row),
      );
      return toComponent(row);
    },

    /** Issues in the component keep their rows and lose the component. */
    async remove(ctx: RequestContext, key: string, id: string): Promise<void> {
      const sql = requireDatabase(deps);
      const project = await authorizedProject(ctx, sql, key, 'work.project.configure');
      const before = await existing(project.id, id);
      await sql`delete from components where id = ${before.id}`;
      await recordChange(
        deps,
        ctx,
        change('component.deleted', before),
        toComponent(before),
        undefined,
      );
    },
  };
}

export type ComponentsService = ReturnType<typeof createComponentsService>;
