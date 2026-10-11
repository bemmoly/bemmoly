import type { ContainerMemberships, RequestContext, SqlClient, SqlExecutor } from '@bemmoly/core';
import { PROJECT_ADMIN_ROLE_KEY } from '../../../../shared/members.ts';
import { userIdOf } from '../lql/access.ts';
import type { ProjectRow } from './rows.ts';

/**
 * A new project's first members: whoever created it, as its project admin,
 * and everyone in the owning team with the team's default role (Member when
 * the team names none). The creator keeps the admin role if also in the team.
 */
export async function joinAsCreator(
  memberships: ContainerMemberships | undefined,
  ctx: RequestContext,
  tx: SqlExecutor,
  project: ProjectRow,
): Promise<void> {
  if (!memberships) return;
  const creator = userIdOf(ctx);
  if (creator) {
    const roles = await memberships.roles(tx);
    const admin = roles.find((role) => role.key === PROJECT_ADMIN_ROLE_KEY);
    await memberships.add(
      'project',
      project.id,
      { userIds: [creator], ...(admin ? { roleId: admin.id } : {}) },
      tx,
    );
  }
  if (project.team_id) {
    await memberships.add('project', project.id, { teamIds: [project.team_id] }, tx);
  }
}

/**
 * The projects the list may show: null for every project (org admins and
 * system jobs), else the ones the person belongs to. Ids rather than a SQL
 * fragment, since an awaited postgres.js fragment would run as a query.
 */
export async function visibleProjectIds(
  sql: SqlClient,
  ctx: RequestContext,
): Promise<string[] | null> {
  if (ctx.actor.kind === 'system' || (await ctx.authz.isOrgAdmin(ctx.actor))) return null;
  const userId = userIdOf(ctx);
  if (!userId) return [];
  const rows = await sql<{ project_id: string }[]>`
    select project_id from project_members where user_id = ${userId}::uuid`;
  return rows.map((row) => row.project_id);
}
