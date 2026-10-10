import type {
  AuditMeta,
  AuditRecorder,
  CollabRegistry,
  ContainerMemberships,
  EntityRegistry,
  EventBus,
  JobRegistry,
  RealtimePublisher,
  RequestContext,
  SettingsRegistry,
  SqlClient,
  SqlExecutor,
} from '@bemmoly/core';
import { ProviderError } from '@bemmoly/shared';
import { DOCS_REALTIME_KINDS, type DocsRealtimeKind } from '../../../shared/realtime.ts';

export interface DocsServiceDeps {
  database?: SqlClient;
  audit?: AuditRecorder;
  realtime?: RealtimePublisher;
  events?: EventBus;
  memberships?: ContainerMemberships;
  /** Server-side edits to open page bodies; absent where no collab host runs. */
  collab?: Pick<CollabRegistry, 'transact'>;
  /** Enqueues the module's own jobs (docs.compact). */
  jobs?: Pick<JobRegistry, 'send'>;
  /** Reads the module's own settings (docs.compactThreshold). */
  settings?: Pick<SettingsRegistry, 'get'>;
  /** Other modules' records (issues) by key or id, without importing those modules. */
  entities?: Pick<EntityRegistry, 'resolve'>;
}

export const DOCS_MODULE = { kind: 'module', moduleId: 'docs' } as const;

/** The authz resource of anything inside a space: membership and overrides apply. */
export const spaceResource = (spaceId: string) =>
  ({ kind: 'space', id: spaceId, moduleId: 'docs' }) as const;

export const UNIQUE_VIOLATION = '23505';

export const iso = (value: Date | string) => new Date(value).toISOString();
export const isoOrNull = (value: Date | string | null) => (value ? iso(value) : null);

export function requireDatabase(deps: Pick<DocsServiceDeps, 'database'>): SqlClient {
  if (!deps.database) throw new ProviderError('The docs module needs the database');
  return deps.database;
}

export function userIdOf(ctx: RequestContext): string | null {
  if (ctx.actor.kind === 'user') return ctx.actor.id;
  if (ctx.actor.kind === 'system') return null;
  return ctx.actor.userId ?? null;
}

/** Where the request came from, for the audit rows. */
export const auditMeta = (ctx: RequestContext): AuditMeta => ({
  ...(ctx.ip ? { ip: ctx.ip } : {}),
  ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
});

/**
 * The spaces a list may show: null for every space (org admins and system
 * jobs), else the ones the person belongs to. Ids rather than a SQL fragment,
 * since an awaited postgres.js fragment would run as a query.
 */
export async function visibleSpaceIds(
  sql: SqlExecutor,
  ctx: RequestContext,
): Promise<string[] | null> {
  if (ctx.actor.kind === 'system' || (await ctx.authz.isOrgAdmin(ctx.actor))) return null;
  const userId = userIdOf(ctx);
  if (!userId) return [];
  const rows = await sql<{ space_id: string }[]>`
    select space_id from space_members where user_id = ${userId}::uuid`;
  return rows.map((row) => row.space_id);
}

/** One audit row; every Docs write records the target and, when it has them, before and after. */
export async function recordAudit(
  deps: Pick<DocsServiceDeps, 'audit'>,
  ctx: RequestContext,
  entry: { action: string; kind: string; id: string; before?: unknown; after?: unknown },
  tx?: SqlExecutor,
): Promise<void> {
  await deps.audit?.record(
    {
      actor: ctx.actor,
      action: entry.action,
      target: { kind: entry.kind, id: entry.id },
      ...(entry.before !== undefined ? { before: entry.before } : {}),
      ...(entry.after !== undefined ? { after: entry.after } : {}),
      meta: auditMeta(ctx),
    },
    tx,
  );
}

/** Tell open screens to refetch; scoped to the space so only its viewers wake up. */
export async function publishChange(
  deps: Pick<DocsServiceDeps, 'realtime'>,
  kind: DocsRealtimeKind,
  spaceId: string,
  ids: readonly string[],
): Promise<void> {
  await deps.realtime?.publish({ kind, ids: [...ids], spaceId });
}

export { DOCS_REALTIME_KINDS };
