import type { AuditMeta, RequestContext, SqlExecutor } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type { Project } from '../../../../shared/projects.ts';
import type { SchemeKind, SchemeOverrideMark } from '../../../../shared/schemes.ts';

export interface ProjectRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  team_id: string | null;
  method: Project['method'];
  scheme_overrides: Partial<Record<SchemeKind, SchemeOverrideMark>>;
  default_space_id: string | null;
  archived_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export const iso = (value: Date | string) => new Date(value).toISOString();

export const toProject = (row: ProjectRow): Project => ({
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

export const PROJECT_COLUMNS = `id, key, name, description, team_id, method, scheme_overrides,
  default_space_id, archived_at, created_at, updated_at`;

/**
 * The project every project-scoped service starts from; the key is the URL
 * segment so a wrong key is a 404 before any capability check names it.
 */
export async function projectByKey(sql: SqlExecutor, key: string): Promise<ProjectRow> {
  const [row] = await sql<ProjectRow[]>`
    select ${sql.unsafe(PROJECT_COLUMNS)} from projects where key = ${key}`;
  if (!row) throw new NotFoundError(`Project ${key} was not found`);
  return row;
}

/** The authz resource of project-scoped work: membership and overrides apply. */
export const projectResource = (projectId: string) =>
  ({ kind: 'project', id: projectId, moduleId: 'work' }) as const;

export const WORK_MODULE = { kind: 'module', moduleId: 'work' } as const;

/** Where the request came from, for the audit rows of project changes. */
export const auditMeta = (ctx: RequestContext): AuditMeta => ({
  ...(ctx.ip ? { ip: ctx.ip } : {}),
  ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
});
