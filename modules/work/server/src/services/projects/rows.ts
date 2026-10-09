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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The project every project-scoped service starts from. The URL segment is
 * its key ("PLT") or its id, since links hold keys and settings hold ids; a
 * wrong one is a 404 before any capability check names it.
 */
export async function projectByKey(sql: SqlExecutor, ref: string): Promise<ProjectRow> {
  const [row] = await sql<ProjectRow[]>`
    select ${sql.unsafe(PROJECT_COLUMNS)} from projects
    where ${UUID.test(ref) ? sql`id = ${ref}::uuid` : sql`key = ${ref.trim().toUpperCase()}`}`;
  if (!row) throw new NotFoundError(`Project ${ref} was not found`);
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
