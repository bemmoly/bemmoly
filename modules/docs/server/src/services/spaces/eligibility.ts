import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import type { SpaceMember } from '../../../../shared/members.ts';
import { iso, spaceResource } from '../common.ts';

interface CandidateRow {
  user_id: string;
  name: string;
  email: string;
  status: SpaceMember['status'];
  role_id: string;
  role_key: string;
  role_name: string;
  access: SpaceMember['access'];
  added_at: Date | string | null;
}

/**
 * The people a space can involve: its membership rows, then the org admins
 * who have none, since authorization lets an org admin into every space. With
 * userIds, only those people. One query, ordered as the member list shows it.
 */
async function candidates(
  sql: SqlExecutor,
  spaceId: string,
  userIds: readonly string[] | null,
): Promise<CandidateRow[]> {
  const only = userIds ? [...userIds] : null;
  return sql<CandidateRow[]>`
    select * from (
      select m.user_id, u.name, u.email, u.status, r.id as role_id, r.key as role_key,
        r.name as role_name, 'member' as access, m.created_at as added_at
      from space_members m
      join users u on u.id = m.user_id
      join roles r on r.id = m.role_id
      where m.space_id = ${spaceId}
        and (${only}::uuid[] is null or m.user_id = any(${only}::uuid[]))
      union all
      select u.id, u.name, u.email, u.status, r.id, r.key, r.name, 'org_admin', null
      from users u
      join roles r on r.id = u.role_id
      where r.key = 'org_admin' and u.status = 'active'
        and (${only}::uuid[] is null or u.id = any(${only}::uuid[]))
        and not exists (
          select 1 from space_members m where m.space_id = ${spaceId} and m.user_id = u.id)
    ) people
    order by lower(name), user_id`;
}

/**
 * Whether each candidate can be asked to review: active, and able to open the
 * space's pages as authorization resolves it for them (module access,
 * membership, the space's overrides). The members list and the reviewers
 * check both come through here, so the picker never offers someone the
 * check then refuses.
 */
export async function spacePeople(
  ctx: RequestContext,
  sql: SqlExecutor,
  spaceId: string,
  userIds: readonly string[] | null = null,
): Promise<SpaceMember[]> {
  const rows = await candidates(sql, spaceId, userIds);
  const resource = spaceResource(spaceId);
  return Promise.all(
    rows.map(async (row): Promise<SpaceMember> => {
      const canReview =
        row.status === 'active' &&
        (await ctx.authz.can({ kind: 'user', id: row.user_id }, 'docs.page.view', resource));
      return {
        userId: row.user_id,
        name: row.name,
        email: row.email,
        status: row.status,
        roleId: row.role_id,
        roleKey: row.role_key,
        roleName: row.role_name,
        access: row.access,
        canReview,
        addedAt: row.added_at ? iso(row.added_at) : null,
      };
    }),
  );
}

/** The subset of userIds who may review pages in the space. */
export async function eligibleReviewers(
  ctx: RequestContext,
  sql: SqlExecutor,
  spaceId: string,
  userIds: readonly string[],
): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const people = await spacePeople(ctx, sql, spaceId, userIds);
  return new Set(people.filter((person) => person.canReview).map((person) => person.userId));
}
