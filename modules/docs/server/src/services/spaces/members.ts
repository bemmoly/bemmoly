import type { ContainerMember, RequestContext, SqlExecutor } from '@bemmoly/core';
import { ConflictError, NotFoundError, ProviderError } from '@bemmoly/shared';
import {
  SPACE_ADMIN_ROLE_KEY,
  type AddSpaceMembersBody,
  type AddSpaceMembersResponse,
  type SpaceMember,
  type SpaceMembersResponse,
} from '../../../../shared/members.ts';
import {
  DOCS_REALTIME_KINDS,
  recordAudit,
  spaceResource,
  type DocsServiceDeps,
} from '../common.ts';
import { spacePeople } from './eligibility.ts';
import { spaceByRef } from './rows.ts';

/**
 * Who is in a space, through the kernel's membership contract. Reading needs
 * page view in the space; every change needs "Configure space" there, is
 * audited in its transaction, and tells the space's screens and each affected
 * person to refetch. Access follows at once, since every space check reads
 * membership per request. A space always keeps one space admin.
 */
export function createSpaceMembersService(deps: DocsServiceDeps) {
  const need = () => {
    if (!deps.database || !deps.memberships) {
      throw new ProviderError('Space members need the database');
    }
    return { sql: deps.database, memberships: deps.memberships };
  };

  async function forChange(ctx: RequestContext, ref: string) {
    const { sql, memberships } = need();
    const space = await spaceByRef(sql, ref);
    await ctx.authz.authorize(ctx.actor, 'docs.space.configure', spaceResource(space.id));
    return { sql, memberships, space };
  }

  /** Serialises member changes per space so two removals cannot both pass the last-admin check. */
  const lock = (tx: SqlExecutor, spaceId: string) =>
    tx`select id from spaces where id = ${spaceId} for update`;

  async function memberOf(tx: SqlExecutor, spaceId: string, userId: string) {
    const members = await need().memberships.list('space', spaceId, tx);
    return { members, member: members.find((row) => row.userId === userId) ?? null };
  }

  function keepAnAdmin(members: readonly ContainerMember[], leaving: string) {
    const admins = members.filter((member) => member.roleKey === SPACE_ADMIN_ROLE_KEY);
    if (admins.length === 1 && admins[0]?.userId === leaving) {
      throw new ConflictError('A space needs at least one space admin', {
        details: { reason: 'last_space_admin' },
      });
    }
  }

  async function announce(tx: SqlExecutor, spaceId: string, userIds: readonly string[]) {
    if (!deps.realtime || userIds.length === 0) return;
    const kind = DOCS_REALTIME_KINDS.space;
    await deps.realtime.publish({ kind, ids: [spaceId], spaceId }, { transaction: tx });
    for (const userId of new Set(userIds)) {
      await deps.realtime.publish({ kind, ids: [spaceId], userId }, { transaction: tx });
    }
  }

  const reread = async (ctx: RequestContext, tx: SqlExecutor, spaceId: string, ids: string[]) =>
    ids.length === 0 ? [] : spacePeople(ctx, tx, spaceId, ids);

  return {
    async list(ctx: RequestContext, ref: string): Promise<SpaceMembersResponse> {
      const { sql, memberships } = need();
      const space = await spaceByRef(sql, ref);
      await ctx.authz.authorize(ctx.actor, 'docs.page.view', spaceResource(space.id));
      const [items, roles, canManage] = await Promise.all([
        spacePeople(ctx, sql, space.id),
        memberships.roles(),
        ctx.authz.can(ctx.actor, 'docs.space.configure', spaceResource(space.id)),
      ]);
      return { items, roles: roles.map(({ id, key, name }) => ({ id, key, name })), canManage };
    },

    async add(
      ctx: RequestContext,
      ref: string,
      body: AddSpaceMembersBody,
    ): Promise<AddSpaceMembersResponse> {
      const { sql, memberships, space } = await forChange(ctx, ref);
      const ids = await sql.begin(async (tx) => {
        await lock(tx, space.id);
        const input = {
          userIds: body.userIds ?? [],
          teamIds: body.teamIds ?? [],
          ...(body.roleId ? { roleId: body.roleId } : {}),
        };
        const rows = await memberships.add('space', space.id, input, tx);
        if (rows.length === 0) return [];
        const after = rows.map(({ userId, roleKey }) => ({ userId, roleKey }));
        await recordAudit(
          deps,
          ctx,
          { action: 'space.members.added', kind: 'space', id: space.id, after },
          tx,
        );
        const added = rows.map((row) => row.userId);
        await announce(tx, space.id, added);
        return added;
      });
      return { items: await reread(ctx, sql, space.id, ids) };
    },

    /** Adds the person with the role, or moves a member to it; the same call either way. */
    async put(ctx: RequestContext, ref: string, userId: string, roleId: string) {
      const { sql, memberships, space } = await forChange(ctx, ref);
      await sql.begin(async (tx) => {
        await lock(tx, space.id);
        const { members, member: before } = await memberOf(tx, space.id, userId);
        if (before?.roleId === roleId) return;
        if (before) {
          const role = (await memberships.roles(tx)).find((row) => row.id === roleId);
          if (!role) throw new NotFoundError('The role was not found');
          if (role.key !== SPACE_ADMIN_ROLE_KEY) keepAnAdmin(members, userId);
          await memberships.setRole('space', space.id, userId, roleId, tx);
        } else {
          const added = await memberships.add('space', space.id, { userIds: [userId], roleId }, tx);
          if (added.length === 0)
            throw new NotFoundError('The person was not found or is inactive');
        }
        const after = { userId, roleId };
        const action = before ? 'space.members.role_changed' : 'space.members.added';
        const change = before ? { before: { userId, roleId: before.roleId }, after } : { after };
        await recordAudit(deps, ctx, { action, kind: 'space', id: space.id, ...change }, tx);
        await announce(tx, space.id, [userId]);
      });
      const [member] = await reread(ctx, sql, space.id, [userId]);
      if (!member) throw new NotFoundError('This person is not a member of the space');
      return member satisfies SpaceMember;
    },

    async remove(ctx: RequestContext, ref: string, userId: string): Promise<void> {
      const { sql, memberships, space } = await forChange(ctx, ref);
      await sql.begin(async (tx) => {
        await lock(tx, space.id);
        const { members, member: before } = await memberOf(tx, space.id, userId);
        if (!before) throw new NotFoundError('This person is not a member of the space');
        keepAnAdmin(members, userId);
        await memberships.remove('space', space.id, userId, tx);
        await recordAudit(
          deps,
          ctx,
          {
            action: 'space.members.removed',
            kind: 'space',
            id: space.id,
            before: { userId, roleKey: before.roleKey },
          },
          tx,
        );
        await announce(tx, space.id, [userId]);
      });
    },
  };
}

export type SpaceMembersService = ReturnType<typeof createSpaceMembersService>;
