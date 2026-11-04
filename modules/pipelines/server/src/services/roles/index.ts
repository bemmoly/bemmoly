import type { RequestContext } from '@bemmoly/core';
import { NotFoundError, ValidationError } from '@bemmoly/shared';
import {
  ROLE_PLACES,
  type InvitePeopleBody,
  type InvitePeopleResponse,
  type PeopleResponse,
  type PersonRole,
  type PipelinesMe,
  type PipelinesPerson,
} from '../../../../shared/roles.ts';
import {
  authorizePipelines,
  personOf,
  requireAccess,
  requireDatabase,
  requirePerson,
  type PipelinesServiceDeps,
} from '../deps.ts';
import { createGroupsService, type RolesGate } from './groups.ts';
import { listPeople } from './people.ts';
import { addMembers, roleOf, writeRole } from './resolve.ts';

/*
 * Roles decide what you see (product rule 7): GET /me answers with the person's role and its
 * places; Platform admins give roles, invite people and keep the approval groups. A role is a
 * permanent binding at the organisation, so the access engine decides with it like any other.
 */

export function createRolesService(deps: PipelinesServiceDeps) {
  const sql = () => requireDatabase(deps);
  const gate: RolesGate = {
    view: async (ctx) => void (await requireAccess(deps).authorizeAction(ctx, 'view', {})),
    admin: async (ctx) => void (await requireAccess(deps).authorizeAction(ctx, 'platform', {})),
  };

  async function assertGroups(groups: readonly string[]) {
    if (groups.length === 0) return;
    const found = await sql()<{ id: string }[]>`
      select id from pipeline_approval_groups where id = any(${groups as string[]}::uuid[])`;
    if (found.length !== new Set(groups).size) throw new NotFoundError('No such approval group');
  }

  async function setRoleOf(ctx: RequestContext, userId: string, role: PersonRole) {
    if (userId === requirePerson(ctx.actor)) {
      // So an install always keeps the Platform admin making the change.
      throw new ValidationError('Another Platform admin changes your role', {
        details: { path: ['role'] },
      });
    }
    await writeRole(sql(), userId, role, personOf(ctx.actor));
  }

  async function personRow(ctx: RequestContext, userId: string): Promise<PipelinesPerson> {
    const [person] = await listPeople(ctx, sql(), [userId]);
    if (!person) throw new NotFoundError('That person has no role in Pipelines');
    return person;
  }

  return {
    groups: createGroupsService(sql, gate),

    async me(ctx: RequestContext): Promise<PipelinesMe> {
      await authorizePipelines(ctx);
      const userId = requirePerson(ctx.actor);
      const [user] = await sql()<{ id: string; name: string }[]>`
        select id, name from users where id = ${userId}::uuid`;
      if (!user) throw new NotFoundError('No such person');
      const role = await roleOf(ctx, sql(), userId);
      return {
        user: { id: user.id, name: user.name, avatarUrl: null },
        role,
        places: role ? [...ROLE_PLACES[role]] : [],
        readOnly: role === null || role === 'viewer',
      };
    },

    async people(ctx: RequestContext): Promise<PeopleResponse> {
      await gate.admin(ctx);
      return { items: await listPeople(ctx, sql()) };
    },

    async setRole(ctx: RequestContext, userId: string, role: PersonRole): Promise<PipelinesPerson> {
      await gate.admin(ctx);
      const [user] =
        await sql()`select id from users where id = ${userId}::uuid and status = 'active'`;
      if (!user) throw new NotFoundError('No such person');
      await setRoleOf(ctx, userId, role);
      return personRow(ctx, userId);
    },

    /** Takes the person out of Pipelines: their role and every approval group. */
    async removePerson(ctx: RequestContext, userId: string): Promise<void> {
      await gate.admin(ctx);
      if (userId === requirePerson(ctx.actor)) {
        throw new ValidationError('Another Platform admin removes you');
      }
      await sql().begin(async (tx) => {
        await tx`
          delete from pipeline_role_bindings
          where subject_kind = 'user' and subject_id = ${userId}::uuid
            and scope_kind = 'organisation' and expires_at is null`;
        await tx`delete from pipeline_approval_group_members where user_id = ${userId}::uuid`;
      });
    },

    /**
     * People with an account get the role at once; the rest wait as pending, by address,
     * and the screen sends them the workspace invitation (`needAccount`).
     */
    async invite(ctx: RequestContext, body: InvitePeopleBody): Promise<InvitePeopleResponse> {
      await gate.admin(ctx);
      await assertGroups(body.groups);
      const emails = [...new Set(body.emails.map((email) => email.trim().toLowerCase()))];
      const by = personOf(ctx.actor);
      const accounts = await sql()<{ id: string; email: string }[]>`
        select id, lower(email) as email from users
        where lower(email) = any(${emails}::text[]) and status <> 'deactivated'`;
      const known = new Map(accounts.map((account) => [account.email, account.id]));
      const needAccount = emails.filter((email) => !known.has(email));
      for (const id of known.values()) {
        await setRoleOf(ctx, id, body.role);
        for (const group of body.groups) await addMembers(sql(), group, [id], by);
      }
      for (const email of needAccount) {
        await sql()`
          insert into pipeline_person_invitations (email, role, group_ids, invited_by)
          values (${email}, ${body.role}, ${body.groups as string[]}::uuid[], ${by}::uuid)
          on conflict (lower(email)) do update
            set role = excluded.role, group_ids = excluded.group_ids,
              invited_by = excluded.invited_by, updated_at = now()`;
      }
      const people = await listPeople(ctx, sql());
      const items = people.filter((person) => emails.includes(person.email.toLowerCase()));
      return { items, needAccount };
    },

    async revokeInvitation(ctx: RequestContext, id: string): Promise<void> {
      await gate.admin(ctx);
      const rows =
        await sql()`delete from pipeline_person_invitations where id = ${id}::uuid returning id`;
      if (rows.length === 0) throw new NotFoundError('No such invitation');
    },
  };
}

export type RolesService = ReturnType<typeof createRolesService>;
