import type {
  AuditRecorder,
  RealtimePublisher,
  RequestContext,
  SqlClient,
  SqlExecutor,
} from '@bemmoly/core';
import type { CapabilityName } from '@bemmoly/shared';
import { ConflictError, NotFoundError, ProviderError, ValidationError } from '@bemmoly/shared';
import { PROJECT_CHANGED } from '../projects/index.ts';
import { auditMeta, projectByKey, projectResource, type ProjectRow } from '../projects/rows.ts';

/*
 * What labels, versions and components share: each is a named row of one
 * project, read by the pickers a page of names at a time, and changed by the
 * people who configure the project, with an audit row and a nudge to the
 * screens that show the project.
 */

export interface CatalogDeps {
  database?: SqlClient;
  audit?: AuditRecorder;
  realtime?: RealtimePublisher;
}

export type CatalogTable = 'labels' | 'versions' | 'components';

export function requireDatabase(deps: CatalogDeps): SqlClient {
  if (!deps.database) throw new ProviderError('The work module needs the database');
  return deps.database;
}

/** The project behind the URL key, once the actor may do `capability` in it. */
export async function authorizedProject(
  ctx: RequestContext,
  sql: SqlExecutor,
  key: string,
  capability: CapabilityName,
): Promise<ProjectRow> {
  const project = await projectByKey(sql, key);
  await ctx.authz.authorize(ctx.actor, capability, projectResource(project.id));
  return project;
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

/**
 * The page filter every picker list shares: names that start with `q`, in
 * name order, after the row the cursor names. Name then id keeps the order
 * total, so two labels called "UI" and "ui" never swap between pages.
 */
export function namePage(
  sql: SqlExecutor,
  table: CatalogTable,
  q: string | undefined,
  cursorId: string | null,
) {
  const prefix = q ? sql`and lower(name) like ${`${escapeLike(q.toLowerCase())}%`}` : sql``;
  const after = cursorId
    ? sql`and (lower(name), id) > (
        (select lower(name) from ${sql.unsafe(table)} where id = ${cursorId}), ${cursorId}::uuid)`
    : sql``;
  return sql`${prefix} ${after}`;
}

const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';

/** Turns the database's "already exists" into the conflict the form shows beside the name. */
export async function storing<T>(what: string, name: string | undefined, work: () => Promise<T>) {
  try {
    return await work();
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === UNIQUE_VIOLATION) {
      throw new ConflictError(`A ${what} called "${name ?? ''}" already exists in this project`);
    }
    if (code === FOREIGN_KEY_VIOLATION) {
      throw new ValidationError(`The ${what} refers to something that does not exist`);
    }
    throw error;
  }
}

export function notFound(what: string): never {
  throw new NotFoundError(`The ${what} was not found in this project`);
}

/** One audit row per change, then the nudge that makes open project screens refetch. */
export async function recordChange(
  deps: CatalogDeps,
  ctx: RequestContext,
  change: { action: string; kind: string; id: string; projectId: string },
  before: unknown,
  after: unknown,
): Promise<void> {
  await deps.audit?.record({
    actor: ctx.actor,
    action: change.action,
    target: { kind: change.kind, id: change.id },
    ...(before === undefined ? {} : { before }),
    ...(after === undefined ? {} : { after }),
    meta: auditMeta(ctx),
  });
  await deps.realtime?.publish({
    kind: PROJECT_CHANGED,
    ids: [change.projectId],
    projectId: change.projectId,
  });
}

export const iso = (value: Date | string) => new Date(value).toISOString();
