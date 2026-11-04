import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import type { ApprovalGroupRef, PersonRole, PipelinesPerson } from '../../../../shared/roles.ts';
import { resolveRoles } from './resolve.ts';

/*
 * Platform › People and roles: everyone with a role, then the people invited who have no
 * account yet. Beside each, the approval groups they are in and the environments they may
 * deploy to without a change request.
 */

interface UserRow {
  id: string;
  name: string;
  email: string;
}

interface EnvironmentRow {
  key: string;
  has_rule: boolean;
  deployers: { users?: string[]; groups?: string[] } | null;
}

interface InvitationRow {
  id: string;
  email: string;
  role: PersonRole;
  group_ids: string[];
}

const DEPLOYING: ReadonlySet<PersonRole> = new Set(['developer', 'platform_admin']);

/**
 * Where a person deploys straight away: a Platform admin anywhere (an emergency deploy skips
 * the rule), others where no approval rule asks and the deployers, if named, include them.
 */
export function deploysTo(
  role: PersonRole,
  userId: string,
  groups: readonly string[],
  environments: readonly EnvironmentRow[],
): string[] {
  if (role === 'platform_admin') return environments.map((env) => env.key);
  if (!DEPLOYING.has(role)) return [];
  return environments
    .filter((env) => !env.has_rule)
    .filter(
      (env) =>
        !env.deployers ||
        (env.deployers.users ?? []).includes(userId) ||
        (env.deployers.groups ?? []).some((group) => groups.includes(group)),
    )
    .map((env) => env.key);
}

async function groupsByUser(sql: SqlExecutor) {
  const rows = await sql<{ user_id: string; id: string; name: string }[]>`
    select m.user_id, g.id, g.name from pipeline_approval_group_members m
      join pipeline_approval_groups g on g.id = m.group_id
    order by lower(g.name)`;
  const groups = new Map<string, ApprovalGroupRef[]>();
  for (const row of rows) {
    groups.set(row.user_id, [...(groups.get(row.user_id) ?? []), { id: row.id, name: row.name }]);
  }
  return groups;
}

export async function listPeople(
  ctx: RequestContext,
  sql: SqlExecutor,
  only?: readonly string[],
): Promise<PipelinesPerson[]> {
  const [users, environments, groups, invitations, groupNames] = await Promise.all([
    sql<UserRow[]>`
      select id, name, email from users
      where status = 'active'
        ${only ? sql`and id = any(${only as string[]}::uuid[])` : sql``}
      order by lower(name) limit 1000`,
    sql<EnvironmentRow[]>`
      select key, approval_rule is not null as has_rule, deployers from pipeline_environments
      where archived_at is null order by position, key`,
    groupsByUser(sql),
    only
      ? Promise.resolve([] as InvitationRow[])
      : sql<InvitationRow[]>`
          select id, email, role, group_ids from pipeline_person_invitations
          order by lower(email)`,
    sql<{ id: string; name: string }[]>`select id, name from pipeline_approval_groups`,
  ]);
  const roles = await resolveRoles(
    ctx,
    sql,
    users.map((user) => user.id),
  );
  const people: PipelinesPerson[] = [];
  for (const user of users) {
    const role = roles.get(user.id);
    if (!role) continue;
    const own = groups.get(user.id) ?? [];
    people.push({
      user: { id: user.id, name: user.name, avatarUrl: null },
      email: user.email,
      role,
      groups: own,
      deploysTo: deploysTo(
        role,
        user.id,
        own.map((group) => group.id),
        environments,
      ),
      pending: false,
    });
  }
  const named = new Map(groupNames.map((group) => [group.id, group.name]));
  for (const invite of invitations) {
    people.push({
      user: { id: invite.id, name: invite.email, avatarUrl: null },
      email: invite.email,
      role: invite.role,
      groups: invite.group_ids.flatMap((id) => {
        const name = named.get(id);
        return name ? [{ id, name }] : [];
      }),
      deploysTo: [],
      pending: true,
    });
  }
  return people;
}
