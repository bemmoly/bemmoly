import { decodeCursor, toPage, type RequestContext, type SqlClient } from '@bemmoly/core';
import { ProviderError } from '@bemmoly/shared';
import type { ListProjectsQuery, Project, ProjectsPage } from '../../../shared/projects.ts';

export interface ProjectsServiceDeps {
  database?: SqlClient;
}

interface ProjectRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  team_id: string | null;
  method: Project['method'];
  scheme_overrides: Record<string, unknown>;
  default_space_id: string | null;
  archived_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const iso = (value: Date | string) => new Date(value).toISOString();

const toProject = (row: ProjectRow): Project => ({
  id: row.id,
  key: row.key,
  name: row.name,
  description: row.description,
  teamId: row.team_id,
  method: row.method,
  schemeOverrides: row.scheme_overrides,
  defaultSpaceId: row.default_space_id,
  archivedAt: row.archived_at ? iso(row.archived_at) : null,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
});

/** Projects as the Work screens list them; creation and schemes follow. */
export function createProjectsService(deps: ProjectsServiceDeps) {
  const db = (): SqlClient => {
    if (!deps.database) throw new ProviderError('The work module needs the database');
    return deps.database;
  };

  return {
    async list(ctx: RequestContext, query: ListProjectsQuery): Promise<ProjectsPage> {
      await ctx.authz.authorize(ctx.actor, 'work.issue.view', { kind: 'module', moduleId: 'work' });
      const sql = db();
      const cursor = decodeCursor(query.cursor);
      const rows = await sql<ProjectRow[]>`
        select id, key, name, description, team_id, method, scheme_overrides,
          default_space_id, archived_at, created_at, updated_at
        from projects
        where (${query.archived} or archived_at is null)
          and (${query.teamId ?? null}::uuid is null or team_id = ${query.teamId ?? null})
          ${cursor ? sql`and id > ${cursor}` : sql``}
        order by id
        limit ${query.limit + 1}`;
      const page = toPage(rows, query.limit);
      return { items: page.rows.map(toProject), nextCursor: page.nextCursor };
    },
  };
}

export type ProjectsService = ReturnType<typeof createProjectsService>;
