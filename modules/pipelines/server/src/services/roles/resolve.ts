import type { RequestContext, SqlClient, SqlExecutor } from '@bemmoly/core';
import type { Role } from '../../../../shared/access.ts';
import type { PersonRole } from '../../../../shared/roles.ts';
import { PIPELINES_RESOURCE } from '../deps.ts';

/*
 * Which of the four roles each person holds. The role given on Platform › People and roles
 * decides; without one, a pending invitation to the person's address is claimed; then
 * Bemmoly's organisation admins are Platform admins (so the installing person is in on a
 * fresh install); then a team binding from before the four roles maps to the nearest one.
 * Anyone else has no role and sees nothing.
 */

const RANK: Record<PersonRole, number> = {
  viewer: 0,
  approver: 1,
  developer: 2,
  platform_admin: 3,
};

/** The older binding roles, read as the four. */
export function personRoleOf(role: Role): PersonRole {
  switch (role) {
    case 'platform_admin':
      return 'platform_admin';
    case 'approver':
      return 'approver';
    case 'developer':
    case 'maintainer':
    case 'release_manager':
      return 'developer';
    case 'viewer':
    case 'auditor':
      return 'viewer';
  }
}

const stronger = (a: PersonRole | undefined, b: PersonRole) =>
  a === undefined || RANK[b] > RANK[a] ? b : a;

interface RoleRow {
  user_id: string;
  role: Role;
}

/** The role each person was given here, a permanent binding at the organisation. */
export async function givenRoles(sql: SqlExecutor, userIds: readonly string[]) {
  const rows = await sql<RoleRow[]>`
    select subject_id as user_id, role from pipeline_role_bindings
    where subject_kind = 'user' and scope_kind = 'organisation' and expires_at is null
      and subject_id = any(${userIds as string[]}::uuid[])`;
  const roles = new Map<string, PersonRole>();
  for (const row of rows)
    roles.set(row.user_id, stronger(roles.get(row.user_id), personRoleOf(row.role)));
  return roles;
}

/** Roles from team bindings and break-glass, at any scope, for installs that had them. */
async function boundRoles(sql: SqlExecutor, userIds: readonly string[]) {
  const rows = await sql<RoleRow[]>`
    select coalesce(m.user_id, b.subject_id) as user_id, b.role
    from pipeline_role_bindings b
      left join team_members m on b.subject_kind = 'team' and m.team_id = b.subject_id
    where (b.expires_at is null or b.expires_at > now())
      and coalesce(m.user_id, case when b.subject_kind = 'user' then b.subject_id end)
        = any(${userIds as string[]}::uuid[])`;
  const roles = new Map<string, PersonRole>();
  for (const row of rows)
    roles.set(row.user_id, stronger(roles.get(row.user_id), personRoleOf(row.role)));
  return roles;
}

async function isOrgAdmin(ctx: RequestContext, userId: string): Promise<boolean> {
  return ctx.authz.can(
    { kind: 'user', id: userId },
    'pipelines.platform.admin',
    PIPELINES_RESOURCE,
  );
}

/** Every person's role, or none; one query per source whatever the count. */
export async function resolveRoles(
  ctx: RequestContext,
  sql: SqlExecutor,
  userIds: readonly string[],
): Promise<Map<string, PersonRole | null>> {
  const [given, bound] = await Promise.all([givenRoles(sql, userIds), boundRoles(sql, userIds)]);
  const result = new Map<string, PersonRole | null>();
  await Promise.all(
    userIds.map(async (id) => {
      const own = given.get(id);
      if (own) return void result.set(id, own);
      if (await isOrgAdmin(ctx, id)) return void result.set(id, 'platform_admin');
      result.set(id, bound.get(id) ?? null);
    }),
  );
  return result;
}

/** Gives one person their role, replacing the one they had. */
export async function writeRole(
  sql: SqlExecutor,
  userId: string,
  role: PersonRole,
  by: string | null,
): Promise<void> {
  await sql`
    delete from pipeline_role_bindings
    where subject_kind = 'user' and subject_id = ${userId}::uuid
      and scope_kind = 'organisation' and expires_at is null and role <> ${role}`;
  await sql`
    insert into pipeline_role_bindings (subject_kind, subject_id, role, scope_kind, created_by)
    values ('user', ${userId}::uuid, ${role}, 'organisation', ${by}::uuid)
    on conflict (subject_kind, subject_id, role, scope_kind, scope_id, environment_class)
      do update set expires_at = null, reason = null, updated_at = now()`;
}

export async function addMembers(
  sql: SqlExecutor,
  groupId: string,
  userIds: readonly string[],
  by: string | null,
): Promise<void> {
  if (userIds.length === 0) return;
  await sql`
    insert into pipeline_approval_group_members (group_id, user_id, added_by)
    select ${groupId}::uuid, u, ${by}::uuid from unnest(${userIds as string[]}::uuid[]) as u
    on conflict (group_id, user_id) do nothing`;
}

/**
 * The person's role, claiming a pending invitation to their address first: the role and
 * groups they were invited with become theirs the first time they open Pipelines.
 */
export async function roleOf(
  ctx: RequestContext,
  sql: SqlClient,
  userId: string,
): Promise<PersonRole | null> {
  const own = (await givenRoles(sql, [userId])).get(userId);
  if (own) return own;
  const claimed = await sql.begin(async (tx) => {
    const [invite] = await tx<
      { role: PersonRole; group_ids: string[]; invited_by: string | null }[]
    >`
      delete from pipeline_person_invitations
      where lower(email) = (select lower(email) from users where id = ${userId}::uuid)
      returning role, group_ids, invited_by`;
    if (!invite) return null;
    await writeRole(tx, userId, invite.role, invite.invited_by);
    for (const group of invite.group_ids) {
      await tx`
        insert into pipeline_approval_group_members (group_id, user_id, added_by)
        select id, ${userId}::uuid, ${invite.invited_by}::uuid from pipeline_approval_groups
        where id = ${group}::uuid
        on conflict (group_id, user_id) do nothing`;
    }
    return invite.role;
  });
  if (claimed) return claimed;
  return (await resolveRoles(ctx, sql, [userId])).get(userId) ?? null;
}
