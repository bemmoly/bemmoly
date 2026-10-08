import type {
  EventBus,
  JobRegistry,
  RealtimePublisher,
  RequestContext,
  ResourceRef,
  SqlClient,
  SqlExecutor,
} from '@bemmoly/core';
import { ProviderError } from '@bemmoly/shared';
import type { TransitionGate } from '../workflow/contract.ts';

/** What every issue-side service receives; realtime and events default to no-ops in tests. */
export interface IssueServiceDeps {
  database?: SqlClient;
  realtime: RealtimePublisher;
  events: EventBus;
  jobs?: JobRegistry;
  workflow: TransitionGate;
  now?: () => Date;
}

export const requireDatabase = (deps: Pick<IssueServiceDeps, 'database'>): SqlClient => {
  if (!deps.database) throw new ProviderError('The work module needs the database');
  return deps.database;
};

/** Project-scoped work authorizes against the project, so membership applies. */
export const projectResource = (projectId: string): ResourceRef => ({
  kind: 'project',
  id: projectId,
  moduleId: 'work',
});

export const MODULE_RESOURCE: ResourceRef = { kind: 'module', moduleId: 'work' };

/** The person behind the actor; tokens and plans act for someone, system jobs for nobody. */
export const actorUserId = (ctx: RequestContext): string | null =>
  ctx.actor.userId ?? (ctx.actor.kind === 'user' ? ctx.actor.id : null);

/**
 * Projects the actor may read: null means every project (org admins and
 * system actors); otherwise the projects they are a member of, which is the
 * container membership the kernel's authorize checks.
 */
export async function accessibleProjectIds(
  ctx: RequestContext,
  sql: SqlExecutor,
): Promise<string[] | null> {
  if (await ctx.authz.isOrgAdmin(ctx.actor)) return null;
  const userId = actorUserId(ctx);
  if (!userId) return [];
  const rows = await sql<{ project_id: string }[]>`
    select project_id from project_members where user_id = ${userId}`;
  return rows.map((row) => row.project_id);
}

export const iso = (value: Date | string): string => new Date(value).toISOString();
