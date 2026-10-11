import { NotFoundError } from '@bemmoly/shared';
import type {
  AddMembersInput,
  ContainerMember,
  ContainerMemberships,
  ContainerRole,
  MembershipContainer,
} from '../../contracts/memberships.ts';
import type { SqlExecutor } from '../../contracts/sql.ts';

/*
 * Container membership over postgres.js, as modules see the database. The
 * table and column names come from this fixed map, never from a caller.
 */

const TABLES = {
  project: { table: 'project_members', column: 'project_id' },
  space: { table: 'space_members', column: 'space_id' },
} as const;

/** The role people get when nothing else names one. */
const FALLBACK_ROLE_KEY = 'member';

interface MemberRow {
  user_id: string;
  name: string;
  email: string;
  status: string;
  role_id: string;
  role_key: string;
  role_name: string;
  added_at: Date | string;
}

const toMember = (row: MemberRow): ContainerMember => ({
  userId: row.user_id,
  name: row.name,
  email: row.email,
  status: row.status,
  roleId: row.role_id,
  roleKey: row.role_key,
  roleName: row.role_name,
  addedAt: new Date(row.added_at).toISOString(),
});

export function createContainerMemberships(pool: SqlExecutor): ContainerMemberships {
  const select = async (
    sql: SqlExecutor,
    kind: MembershipContainer,
    containerId: string,
    userIds: readonly string[] | null,
  ): Promise<ContainerMember[]> => {
    const { table, column } = TABLES[kind];
    const rows = await sql<MemberRow[]>`
      select m.user_id, u.name, u.email, u.status, m.role_id, r.key as role_key,
        r.name as role_name, m.created_at as added_at
      from ${sql.unsafe(table)} m
      join users u on u.id = m.user_id
      join roles r on r.id = m.role_id
      where m.${sql.unsafe(column)} = ${containerId}
        ${userIds ? sql`and m.user_id = any(${userIds as string[]}::uuid[])` : sql``}
      order by lower(u.name), u.id`;
    return rows.map(toMember);
  };

  const requireRole = async (sql: SqlExecutor, roleId: string) => {
    const [row] = await sql<{ id: string }[]>`select id from roles where id = ${roleId}`;
    if (!row) throw new NotFoundError('The role was not found');
  };

  return {
    list: (kind, containerId, transaction) => select(transaction ?? pool, kind, containerId, null),

    async add(kind, containerId, input: AddMembersInput, transaction) {
      const sql = transaction ?? pool;
      const { table, column } = TABLES[kind];
      if (input.roleId) await requireRole(sql, input.roleId);
      const userIds = [...new Set(input.userIds ?? [])];
      const teamIds = [...new Set(input.teamIds ?? [])];
      if (userIds.length === 0 && teamIds.length === 0) return [];
      /*
       * Direct picks come first so a person both picked and in a team takes
       * the picked role; distinct on keeps the first candidate per person.
       */
      const added = await sql<{ user_id: string }[]>`
        with candidates as (
          select u.id as user_id, 0 as source, null::uuid as team_role
          from users u where u.id = any(${userIds}::uuid[])
          union all
          select tm.user_id, 1, t.default_role_id
          from team_members tm join teams t on t.id = tm.team_id
          where tm.team_id = any(${teamIds}::uuid[])
        ),
        chosen as (
          select distinct on (c.user_id) c.user_id, c.team_role
          from candidates c join users u on u.id = c.user_id
          where u.status <> 'deactivated'
          order by c.user_id, c.source
        )
        insert into ${sql.unsafe(table)} (${sql.unsafe(column)}, user_id, role_id)
        select ${containerId}, chosen.user_id,
          coalesce(${input.roleId ?? null}::uuid, chosen.team_role,
            (select id from roles where key = ${FALLBACK_ROLE_KEY}))
        from chosen
        on conflict (${sql.unsafe(column)}, user_id) do nothing
        returning user_id`;
      if (added.length === 0) return [];
      return select(
        sql,
        kind,
        containerId,
        added.map((row) => row.user_id),
      );
    },

    async setRole(kind, containerId, userId, roleId, transaction) {
      const sql = transaction ?? pool;
      const { table, column } = TABLES[kind];
      await requireRole(sql, roleId);
      const updated = await sql`
        update ${sql.unsafe(table)} set role_id = ${roleId}, updated_at = now()
        where ${sql.unsafe(column)} = ${containerId} and user_id = ${userId}
        returning user_id`;
      if (updated.length === 0) return null;
      const [member] = await select(sql, kind, containerId, [userId]);
      return member ?? null;
    },

    async remove(kind, containerId, userId, transaction) {
      const sql = transaction ?? pool;
      const { table, column } = TABLES[kind];
      const removed = await sql`
        delete from ${sql.unsafe(table)}
        where ${sql.unsafe(column)} = ${containerId} and user_id = ${userId}
        returning user_id`;
      return removed.length > 0;
    },

    async roles(transaction) {
      const sql = transaction ?? pool;
      const rows = await sql<{ id: string; key: string; name: string; is_system: boolean }[]>`
        select id, key, name, is_system from roles order by is_system desc, created_at, id`;
      return rows.map((row): ContainerRole => ({
        id: row.id,
        key: row.key,
        name: row.name,
        isSystem: row.is_system,
      }));
    },
  };
}
