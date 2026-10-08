import type { RequestContext, SqlClient, SqlFragment } from '@bemmoly/core';

/** The person an actor acts for, or null for system jobs. */
export function userIdOf(ctx: RequestContext): string | null {
  if (ctx.actor.kind === 'user') return ctx.actor.id;
  if (ctx.actor.kind === 'system') return null;
  return ctx.actor.userId ?? null;
}

/**
 * Every compiled query carries the actor's project access, as §16 asks for
 * search: org admins and system jobs see every project, everyone else the
 * projects they are a member of. Applied in SQL so a page never leaks a key.
 */
export async function accessFilter(sql: SqlClient, ctx: RequestContext): Promise<SqlFragment> {
  if (ctx.actor.kind === 'system' || (await ctx.authz.isOrgAdmin(ctx.actor))) return sql`true`;
  const userId = userIdOf(ctx);
  if (!userId) return sql`false`;
  return sql`issues.project_id in (
    select project_id from project_members where user_id = ${userId}::uuid)`;
}
