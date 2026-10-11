import { decodeCursor, toPage, type RequestContext } from '@bemmoly/core';
import { ProviderError, ValidationError } from '@bemmoly/shared';
import type {
  CreateVersionBody,
  ListVersionsQuery,
  UpdateVersionBody,
  Version,
  VersionsPage,
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

interface VersionRow {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  /** Absent on rows read before the roadmap's changeset. */
  start_at?: Date | string | null;
  release_at: Date | string | null;
  status: Version['status'];
  released_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const COLUMNS = `id, project_id, name, description, start_at::text as start_at,
  release_at::text as release_at, status, released_at, created_at, updated_at`;

const day = (value: Date | string | null | undefined): string | null =>
  value === null || value === undefined ? null : String(value).slice(0, 10);

/** A start after the release would draw a bar backwards; say so rather than store it. */
function assertOrdered(startAt: string | null, releaseAt: string | null): void {
  if (startAt && releaseAt && startAt > releaseAt) {
    throw new ValidationError('A version starts on or before its release date', {
      details: { path: 'startAt' },
    });
  }
}

const toVersion = (row: VersionRow): Version => ({
  id: row.id,
  projectId: row.project_id,
  name: row.name,
  description: row.description,
  startAt: day(row.start_at),
  releaseAt: day(row.release_at),
  status: row.status,
  releasedAt: row.released_at ? iso(row.released_at) : null,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
});

/**
 * A project's versions: a name, an optional planned release date and where
 * the version is in its life. Marking it released stamps when that happened;
 * moving it back to unreleased clears the stamp, archiving keeps it.
 */
export function createVersionsService(deps: CatalogDeps) {
  const change = (action: string, row: VersionRow) =>
    ({ action, kind: 'version', id: row.id, projectId: row.project_id }) as const;

  async function existing(projectId: string, id: string): Promise<VersionRow> {
    const sql = requireDatabase(deps);
    const [row] = await sql<VersionRow[]>`
      select ${sql.unsafe(COLUMNS)} from versions where id = ${id} and project_id = ${projectId}`;
    return row ?? notFound('version');
  }

  return {
    async list(ctx: RequestContext, key: string, query: ListVersionsQuery): Promise<VersionsPage> {
      const sql = requireDatabase(deps);
      const project = await authorizedProject(ctx, sql, key, 'work.issue.view');
      const rows = await sql<VersionRow[]>`
        select ${sql.unsafe(COLUMNS)} from versions
        where project_id = ${project.id}
          and (${query.status ?? null}::text is null or status = ${query.status ?? null})
          ${namePage(sql, 'versions', query.q, decodeCursor(query.cursor))}
        order by lower(name), id
        limit ${query.limit + 1}`;
      const page = toPage(rows, query.limit);
      return { items: page.rows.map(toVersion), nextCursor: page.nextCursor };
    },

    async create(ctx: RequestContext, key: string, body: CreateVersionBody): Promise<Version> {
      const sql = requireDatabase(deps);
      const project = await authorizedProject(ctx, sql, key, 'work.project.configure');
      const [row] = await storing(
        'version',
        body.name,
        () =>
          sql<VersionRow[]>`
          insert into versions (project_id, name, description, start_at, release_at)
          values (${project.id}, ${body.name}, ${body.description ?? null},
            ${body.startAt ?? null}::date, ${body.releaseAt ?? null}::date)
          returning ${sql.unsafe(COLUMNS)}`,
      );
      if (!row) throw new ProviderError('The version was not stored');
      await recordChange(deps, ctx, change('version.created', row), undefined, toVersion(row));
      return toVersion(row);
    },

    async update(
      ctx: RequestContext,
      key: string,
      id: string,
      body: UpdateVersionBody,
    ): Promise<Version> {
      const sql = requireDatabase(deps);
      const project = await authorizedProject(ctx, sql, key, 'work.project.configure');
      const before = await existing(project.id, id);
      assertOrdered(
        body.startAt === undefined ? day(before.start_at) : body.startAt,
        body.releaseAt === undefined ? day(before.release_at) : body.releaseAt,
      );
      const status = body.status ?? before.status;
      const [row] = await storing(
        'version',
        body.name,
        () =>
          sql<VersionRow[]>`
          update versions set
            name = coalesce(${body.name ?? null}, name),
            description = case when ${body.description !== undefined}
              then ${body.description ?? null} else description end,
            start_at = case when ${body.startAt !== undefined}
              then ${body.startAt ?? null}::date else start_at end,
            release_at = case when ${body.releaseAt !== undefined}
              then ${body.releaseAt ?? null}::date else release_at end,
            status = ${status},
            released_at = case
              when ${status} = 'unreleased' then null
              when ${status} = 'released' and status <> 'released' then now()
              else released_at end,
            updated_at = now()
          where id = ${before.id}
          returning ${sql.unsafe(COLUMNS)}`,
      );
      if (!row) return notFound('version');
      const action = row.status !== before.status ? `version.${row.status}` : 'version.updated';
      await recordChange(deps, ctx, change(action, row), toVersion(before), toVersion(row));
      return toVersion(row);
    },

    /** Issues that named it as their fix version keep their rows and lose the version. */
    async remove(ctx: RequestContext, key: string, id: string): Promise<void> {
      const sql = requireDatabase(deps);
      const project = await authorizedProject(ctx, sql, key, 'work.project.configure');
      const before = await existing(project.id, id);
      await sql`delete from versions where id = ${before.id}`;
      await recordChange(
        deps,
        ctx,
        change('version.deleted', before),
        toVersion(before),
        undefined,
      );
    },
  };
}

export type VersionsService = ReturnType<typeof createVersionsService>;
