import type { RequestContext, ResourceRef, SqlExecutor } from '@bemmoly/core';

/**
 * Epics are issues of an epic-level type, and "Manage epics" is asked on top of the issue
 * capability whenever one is created, edited, retyped into or out of an epic, or deleted.
 * Types that are not epics cost one indexed lookup and nothing else.
 */
export async function authorizeEpics(
  ctx: RequestContext,
  sql: SqlExecutor,
  resource: ResourceRef,
  typeIds: ReadonlyArray<string | undefined>,
): Promise<void> {
  const ids = [...new Set(typeIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return;
  const [epic] = await sql<{ id: string }[]>`
    select id from issue_types where id = any(${ids}::uuid[]) and level = 'epic' limit 1`;
  if (epic) await ctx.authz.authorize(ctx.actor, 'work.epic.manage', resource);
}
