import type { RequestContext, ResourceRef, SqlExecutor } from '@bemmoly/core';
import { ConflictError } from '@bemmoly/shared';
import type { SchemeKind } from '../../../../shared/schemes.ts';
import { projectByKey, projectResource, WORK_MODULE, type ProjectRow } from './rows.ts';

/**
 * Where a scheme call lands: the org defaults (no project) or one project,
 * which reads its own copy when it has overridden the kind and the org
 * defaults otherwise.
 */
export interface SchemeScope {
  project: ProjectRow | null;
  /** The project id the rows carry, or null for the org defaults being read. */
  rowsProjectId: string | null;
  overridden: boolean;
  resource: ResourceRef;
}

export async function resolveScope(
  sql: SqlExecutor,
  kind: SchemeKind,
  projectKey: string | null,
): Promise<SchemeScope> {
  if (!projectKey)
    return { project: null, rowsProjectId: null, overridden: false, resource: WORK_MODULE };
  const project = await projectByKey(sql, projectKey);
  const overridden = Boolean(project.scheme_overrides[kind]);
  return {
    project,
    rowsProjectId: overridden ? project.id : null,
    overridden,
    resource: projectResource(project.id),
  };
}

/** Reading needs issue view; changing a scheme needs project configuration. */
export async function authorizeScope(
  ctx: RequestContext,
  scope: SchemeScope,
  write: boolean,
): Promise<void> {
  await ctx.authz.authorize(
    ctx.actor,
    write ? 'work.project.configure' : 'work.issue.view',
    scope.resource,
  );
}

/**
 * A project edits only its own copy: editing the org defaults from inside a
 * project would change every other project too, so the UI overrides first.
 */
export function writableProjectId(scope: SchemeScope, kind: SchemeKind): string | null {
  if (scope.project && !scope.overridden) {
    throw new ConflictError(`Override the ${kind.replace('_', ' ')} scheme before editing it`);
  }
  return scope.rowsProjectId;
}

/**
 * The scope a row-addressed call acts in: the project in the URL, else the
 * project the row belongs to, so PATCH /issue-types/:id edits a project's
 * copy the same as /projects/:key/issue-types/:id does.
 */
export async function scopeOfRow(
  sql: SqlExecutor,
  table: 'issue_types' | 'fields',
  projectKey: string | null,
  id: string,
): Promise<string | null> {
  if (projectKey) return projectKey;
  const [row] = await sql<{ project_id: string | null }[]>`
    select project_id from ${sql.unsafe(table)} where id = ${id}`;
  return row?.project_id ?? null;
}
