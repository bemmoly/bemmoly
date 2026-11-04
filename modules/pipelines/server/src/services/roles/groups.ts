import type { RequestContext, SqlClient, SqlExecutor } from '@bemmoly/core';
import { ConflictError, NotFoundError, ValidationError } from '@bemmoly/shared';
import type {
  AddGroupMembersBody,
  ApprovalGroup,
  CreateApprovalGroupBody,
  UpdateApprovalGroupBody,
} from '../../../../shared/roles.ts';
import { isoOrNull } from '../../utils/time.ts';
import { personOf } from '../deps.ts';
import { addMembers, resolveRoles } from './resolve.ts';

/*
 * Approval groups: named sets of people ("Production approvers") an environment's approval
 * rule asks. Everyone with a role reads them (a requester picks approvers from them); only
 * Platform admins change them. A group a rule still names cannot be deleted.
 */

interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  created_at: Date | string;
}

interface MemberRow {
  group_id: string;
  user_id: string;
  name: string;
  created_at: Date | string;
}

interface UseRow {
  group_id: string;
  key: string;
  name: string;
}

async function load(ctx: RequestContext, sql: SqlExecutor, id?: string): Promise<ApprovalGroup[]> {
  const only = id ? sql`where g.id = ${id}::uuid` : sql``;
  const [groups, members, uses] = await Promise.all([
    sql<GroupRow[]>`
      select g.id, g.name, g.description, g.created_at from pipeline_approval_groups g ${only}
      order by lower(g.name)`,
    sql<MemberRow[]>`
      select m.group_id, m.user_id, u.name, m.created_at from pipeline_approval_group_members m
        join users u on u.id = m.user_id
      ${id ? sql`where m.group_id = ${id}::uuid` : sql``}
      order by lower(u.name)`,
    sql<UseRow[]>`
      select distinct s ->> 'group' as group_id, e.key, e.name, e.position
      from pipeline_environments e,
        jsonb_array_elements(coalesce(e.approval_rule -> 'steps', '[]'::jsonb)) s
      where e.archived_at is null
      order by e.position`,
  ]);
  const roles = await resolveRoles(ctx, sql, [...new Set(members.map((m) => m.user_id))]);
  return groups.map((group) => ({
    id: group.id,
    name: group.name,
    description: group.description,
    members: members
      .filter((member) => member.group_id === group.id)
      .map((member) => ({
        user: { id: member.user_id, name: member.name, avatarUrl: null },
        // Removing someone from Pipelines takes them out of every group too.
        role: roles.get(member.user_id) ?? 'viewer',
        addedAt: isoOrNull(member.created_at) ?? '',
      })),
    usedBy: uses
      .filter((use) => use.group_id === group.id)
      .map((use) => ({ key: use.key, name: use.name })),
    createdAt: isoOrNull(group.created_at) ?? '',
  }));
}

async function one(ctx: RequestContext, sql: SqlExecutor, id: string): Promise<ApprovalGroup> {
  const [group] = await load(ctx, sql, id);
  if (!group) throw new NotFoundError('No such approval group');
  return group;
}

/** Only people with a role join a group: an approver must be able to open the change. */
async function assertInPipelines(ctx: RequestContext, sql: SqlExecutor, users: readonly string[]) {
  const roles = await resolveRoles(ctx, sql, users);
  const missing = users.filter((user) => !roles.get(user));
  if (missing.length > 0) {
    throw new ValidationError('Invite these people to Pipelines before adding them to a group', {
      details: { users: missing },
    });
  }
}

function nameTaken(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505'
  );
}

export interface RolesGate {
  view(ctx: RequestContext): Promise<void>;
  admin(ctx: RequestContext): Promise<void>;
}

export function createGroupsService(sql: () => SqlClient, gate: RolesGate) {
  const authorizeAdmin = gate.admin;
  return {
    async list(ctx: RequestContext): Promise<ApprovalGroup[]> {
      await gate.view(ctx);
      return load(ctx, sql());
    },

    async create(ctx: RequestContext, body: CreateApprovalGroupBody): Promise<ApprovalGroup> {
      await authorizeAdmin(ctx);
      const db = sql();
      await assertInPipelines(ctx, db, body.members);
      const by = personOf(ctx.actor);
      try {
        const id = await db.begin(async (tx) => {
          const [row] = await tx<{ id: string }[]>`
            insert into pipeline_approval_groups (name, description, created_by)
            values (${body.name}, ${body.description ?? null}, ${by}::uuid) returning id`;
          if (!row) throw new ConflictError('The group was not saved');
          await addMembers(tx, row.id, body.members, by);
          return row.id;
        });
        return await one(ctx, db, id);
      } catch (error) {
        if (nameTaken(error))
          throw new ConflictError(`There is already a group called "${body.name}"`);
        throw error;
      }
    },

    async update(ctx: RequestContext, id: string, body: UpdateApprovalGroupBody) {
      await authorizeAdmin(ctx);
      const db = sql();
      try {
        const rows = await db`
          update pipeline_approval_groups set
            name = coalesce(${body.name ?? null}, name),
            description = ${body.description === undefined ? db`description` : body.description},
            updated_at = now()
          where id = ${id}::uuid returning id`;
        if (rows.length === 0) throw new NotFoundError('No such approval group');
      } catch (error) {
        if (nameTaken(error))
          throw new ConflictError(`There is already a group called "${body.name ?? ''}"`);
        throw error;
      }
      return one(ctx, db, id);
    },

    async remove(ctx: RequestContext, id: string): Promise<void> {
      await authorizeAdmin(ctx);
      const db = sql();
      const group = await one(ctx, db, id);
      if (group.usedBy.length > 0) {
        const names = group.usedBy.map((env) => env.name).join(', ');
        throw new ConflictError(
          `${group.name} is in the approval rule of ${names}. Take it out there first.`,
        );
      }
      await db`delete from pipeline_approval_groups where id = ${id}::uuid`;
    },

    async addMembers(ctx: RequestContext, id: string, body: AddGroupMembersBody) {
      await authorizeAdmin(ctx);
      const db = sql();
      await one(ctx, db, id);
      await assertInPipelines(ctx, db, body.users);
      await addMembers(db, id, body.users, personOf(ctx.actor));
      return one(ctx, db, id);
    },

    async removeMember(ctx: RequestContext, id: string, userId: string): Promise<void> {
      await authorizeAdmin(ctx);
      const rows = await sql()`
        delete from pipeline_approval_group_members
        where group_id = ${id}::uuid and user_id = ${userId}::uuid returning id`;
      if (rows.length === 0) throw new NotFoundError('That person is not in this group');
    },
  };
}
