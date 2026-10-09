import { decodeCursor, toPage, type RequestContext } from '@bemmoly/core';
import { ProviderError } from '@bemmoly/shared';
import type {
  CreateLabelBody,
  Label,
  LabelsPage,
  ListLabelsQuery,
  UpdateLabelBody,
} from '../../../../shared/links-labels.ts';
import {
  authorizedProject,
  iso,
  namePage,
  notFound,
  recordChange,
  requireDatabase,
  storing,
  type CatalogDeps,
} from './catalog.ts';

export type { CatalogDeps } from './catalog.ts';

interface LabelRow {
  id: string;
  project_id: string;
  name: string;
  color: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const COLUMNS = 'id, project_id, name, color, created_at, updated_at';

const toLabel = (row: LabelRow): Label => ({
  id: row.id,
  projectId: row.project_id,
  name: row.name,
  color: row.color,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
});

/**
 * A project's labels. Anyone who edits issues may add one from the create
 * form, as typing a new label there does; renaming or deleting one changes
 * every issue that carries it, so that is project configuration.
 */
export function createLabelsService(deps: CatalogDeps) {
  const change = (action: string, row: LabelRow) =>
    ({ action, kind: 'label', id: row.id, projectId: row.project_id }) as const;

  async function existing(projectId: string, id: string): Promise<LabelRow> {
    const sql = requireDatabase(deps);
    const [row] = await sql<LabelRow[]>`
      select ${sql.unsafe(COLUMNS)} from labels where id = ${id} and project_id = ${projectId}`;
    return row ?? notFound('label');
  }

  return {
    async list(ctx: RequestContext, key: string, query: ListLabelsQuery): Promise<LabelsPage> {
      const sql = requireDatabase(deps);
      const project = await authorizedProject(ctx, sql, key, 'work.issue.view');
      const rows = await sql<LabelRow[]>`
        select ${sql.unsafe(COLUMNS)} from labels
        where project_id = ${project.id}
          ${namePage(sql, 'labels', query.q, decodeCursor(query.cursor))}
        order by lower(name), id
        limit ${query.limit + 1}`;
      const page = toPage(rows, query.limit);
      return { items: page.rows.map(toLabel), nextCursor: page.nextCursor };
    },

    async create(ctx: RequestContext, key: string, body: CreateLabelBody): Promise<Label> {
      const sql = requireDatabase(deps);
      const project = await authorizedProject(ctx, sql, key, 'work.issue.edit');
      const [row] = await storing(
        'label',
        body.name,
        () =>
          sql<LabelRow[]>`
          insert into labels (project_id, name, color)
          values (${project.id}, ${body.name}, ${body.color ?? null})
          returning ${sql.unsafe(COLUMNS)}`,
      );
      if (!row) throw new ProviderError('The label was not stored');
      await recordChange(deps, ctx, change('label.created', row), undefined, toLabel(row));
      return toLabel(row);
    },

    async update(
      ctx: RequestContext,
      key: string,
      id: string,
      body: UpdateLabelBody,
    ): Promise<Label> {
      const sql = requireDatabase(deps);
      const project = await authorizedProject(ctx, sql, key, 'work.project.configure');
      const before = await existing(project.id, id);
      const [row] = await storing(
        'label',
        body.name,
        () =>
          sql<LabelRow[]>`
          update labels set
            name = coalesce(${body.name ?? null}, name),
            color = case when ${body.color !== undefined} then ${body.color ?? null}
              else color end,
            updated_at = now()
          where id = ${before.id}
          returning ${sql.unsafe(COLUMNS)}`,
      );
      if (!row) return notFound('label');
      await recordChange(deps, ctx, change('label.updated', row), toLabel(before), toLabel(row));
      return toLabel(row);
    },

    /** Issues lose the label with it; the issue rows themselves are untouched. */
    async remove(ctx: RequestContext, key: string, id: string): Promise<void> {
      const sql = requireDatabase(deps);
      const project = await authorizedProject(ctx, sql, key, 'work.project.configure');
      const before = await existing(project.id, id);
      await sql`delete from labels where id = ${before.id}`;
      await recordChange(deps, ctx, change('label.deleted', before), toLabel(before), undefined);
    },
  };
}

export type LabelsService = ReturnType<typeof createLabelsService>;
