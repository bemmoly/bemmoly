import type {
  Approvals,
  AuditMeta,
  AuditRecorder,
  EventBus,
  ModuleCustomFields,
  PersonDirectory,
  RealtimePublisher,
  RequestContext,
  SqlClient,
  SqlExecutor,
} from '@bemmoly/core';
import { ForbiddenError, ProviderError } from '@bemmoly/shared';

export interface PeopleServiceDeps {
  database?: SqlClient;
  audit?: AuditRecorder;
  /** The kernel's person record (ADR 0050): every person, manager and location read here. */
  people?: PersonDirectory;
  /** The approval engine (ADR 0051), which leave requests run through. */
  approvals?: Approvals;
  /** Company fields on a profile (ADR 0052), entity type `person`. */
  customFields?: ModuleCustomFields;
  events?: EventBus;
  realtime?: RealtimePublisher;
  now?: () => Date;
}

export const PEOPLE_MODULE = { kind: 'module', moduleId: 'people' } as const;

/** Changing the ladder, leave policies and journey templates. */
export const SETTINGS_CAPABILITY = 'people.settings.manage';
/** Running journeys for anyone and reassigning their tasks. */
export const JOURNEYS_CAPABILITY = 'people.journeys.manage';
/** Writing company fields on anyone's profile; each field's own roles still apply. */
export const PROFILES_CAPABILITY = 'people.profiles.edit';
/** Seeing and managing everyone's time off. */
export const LEAVE_CAPABILITY = 'people.leave.manage';

export const iso = (value: Date | string) => new Date(value).toISOString();
export const isoOrNull = (value: Date | string | null) => (value ? iso(value) : null);
/** A Postgres `date` as `YYYY-MM-DD`, whatever the driver handed back. */
export const dateOf = (value: Date | string) =>
  typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);

export const today = (deps: Pick<PeopleServiceDeps, 'now'>) =>
  (deps.now?.() ?? new Date()).toISOString().slice(0, 10);

export function requireDatabase(deps: Pick<PeopleServiceDeps, 'database'>): SqlClient {
  if (!deps.database) throw new ProviderError('The people module needs the database');
  return deps.database;
}

export function requireDirectory(deps: Pick<PeopleServiceDeps, 'people'>): PersonDirectory {
  if (!deps.people) throw new ProviderError('The people module needs the person record');
  return deps.people;
}

export function userIdOf(ctx: RequestContext): string | null {
  if (ctx.actor.kind === 'user') return ctx.actor.id;
  if (ctx.actor.kind === 'system') return null;
  return ctx.actor.userId ?? null;
}

/** The person behind the request; People's own pages are a person's, never a token's alone. */
export function requireUser(ctx: RequestContext): string {
  const userId = userIdOf(ctx);
  if (!userId) throw new ForbiddenError('Only a signed-in person can do this');
  return userId;
}

export const can = (ctx: RequestContext, capability: string) =>
  ctx.authz.can(ctx.actor, capability as never, PEOPLE_MODULE);

export const authorize = (ctx: RequestContext, capability: string) =>
  ctx.authz.authorize(ctx.actor, capability as never, PEOPLE_MODULE);

const auditMeta = (ctx: RequestContext): AuditMeta => ({
  ...(ctx.ip ? { ip: ctx.ip } : {}),
  ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
});

/** One audit row per write: the target and, when it has them, before and after. */
export async function recordAudit(
  deps: Pick<PeopleServiceDeps, 'audit'>,
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

/** Tells open People screens to refetch. */
export async function publishChange(
  deps: Pick<PeopleServiceDeps, 'realtime'>,
  kind: 'people.leave' | 'people.journeys' | 'people.settings',
  ids: readonly string[],
): Promise<void> {
  await deps.realtime?.publish({ kind, ids: [...ids], moduleId: 'people' });
}

export const UNIQUE_VIOLATION = '23505';
export const pgCode = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : null;
