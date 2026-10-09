import type {
  AuditRecorder,
  ContainerMember,
  ContainerMemberships,
  RealtimePublisher,
  RequestContext,
  SqlClient,
  SqlExecutor,
} from '@bemmoly/core';
import { ConflictError, NotFoundError, ProviderError } from '@bemmoly/shared';
import {
  PROJECT_ADMIN_ROLE_KEY,
  type AddProjectMembersBody,
  type ProjectMember,
  type ProjectMembersResponse,
} from '../../../../shared/members.ts';
import { WORK_REALTIME_KINDS } from '../../../../shared/realtime.ts';
import { auditMeta, projectByKey, projectResource, type ProjectRow } from './rows.ts';

export interface ProjectMembersDeps {
  database?: SqlClient;
  audit?: AuditRecorder;
  realtime?: RealtimePublisher;
  memberships?: ContainerMemberships;
}

const toMember = (member: ContainerMember): ProjectMember => ({
  ...member,
  status: member.status as ProjectMember['status'],
});

/**
 * Who is on a project, through the kernel's membership contract. Reading
 * needs issue view inside the project; every change needs "Configure
 * project" there, is audited in its transaction and tells the project's
 * sockets and each affected person's own to refetch. Access follows at once:
 * every project check reads membership per request.
 */
export function createProjectMembersService(deps: ProjectMembersDeps) {
  const need = () => {
    if (!deps.database || !deps.memberships) {
      throw new ProviderError('Project members need the database');
    }
    return { sql: deps.database, memberships: deps.memberships };
  };

  async function forChange(ctx: RequestContext, ref: string) {
    const { sql, memberships } = need();
    const project = await projectByKey(sql, ref);
    await ctx.authz.authorize(ctx.actor, 'work.project.configure', projectResource(project.id));
    return { sql, memberships, project };
  }

  /** Serialises member changes per project so two removals cannot both pass the last-admin check. */
  const lock = (tx: SqlExecutor, projectId: string) =>
    tx`select id from projects where id = ${projectId} for update`;

  async function keepAnAdmin(tx: SqlExecutor, projectId: string, leaving: string) {
    const members = await need().memberships.list('project', projectId, tx);
    const admins = members.filter((member) => member.roleKey === PROJECT_ADMIN_ROLE_KEY);
    if (admins.length === 1 && admins[0]?.userId === leaving) {
      throw new ConflictError('A project needs at least one project admin', {
        details: { reason: 'last_project_admin' },
      });
    }
  }

  async function record(
    ctx: RequestContext,
    tx: SqlExecutor,
    project: ProjectRow,
    action: string,
    change: { before?: unknown; after?: unknown },
  ) {
    await deps.audit?.record(
      {
        actor: ctx.actor,
        action,
        target: { kind: 'project', id: project.id },
        ...change,
        meta: auditMeta(ctx),
      },
      tx,
    );
  }

  async function announce(tx: SqlExecutor, projectId: string, userIds: readonly string[]) {
    if (!deps.realtime || userIds.length === 0) return;
    const kind = WORK_REALTIME_KINDS.members;
    await deps.realtime.publish({ kind, ids: userIds, projectId }, { transaction: tx });
    for (const userId of new Set(userIds)) {
      await deps.realtime.publish({ kind, ids: [projectId], userId }, { transaction: tx });
    }
  }

  return {
    async list(ctx: RequestContext, ref: string): Promise<ProjectMembersResponse> {
      const { sql, memberships } = need();
      const project = await projectByKey(sql, ref);
      await ctx.authz.authorize(ctx.actor, 'work.issue.view', projectResource(project.id));
      const [items, roles, canManage] = await Promise.all([
        memberships.list('project', project.id),
        memberships.roles(),
        ctx.authz.can(ctx.actor, 'work.project.configure', projectResource(project.id)),
      ]);
      return {
        items: items.map(toMember),
        roles: roles.map(({ id, key, name }) => ({ id, key, name })),
        canManage,
      };
    },

    async add(ctx: RequestContext, ref: string, body: AddProjectMembersBody) {
      const { sql, memberships, project } = await forChange(ctx, ref);
      const added = await sql.begin(async (tx) => {
        await lock(tx, project.id);
        const rows = await memberships.add(
          'project',
          project.id,
          {
            userIds: body.userIds ?? [],
            teamIds: body.teamIds ?? [],
            ...(body.roleId ? { roleId: body.roleId } : {}),
          },
          tx,
        );
        if (rows.length > 0) {
          await record(ctx, tx, project, 'project.members.added', { after: rows });
          await announce(
            tx,
            project.id,
            rows.map((row) => row.userId),
          );
        }
        return rows;
      });
      return { items: (added as ContainerMember[]).map(toMember) };
    },

    async setRole(ctx: RequestContext, ref: string, userId: string, roleId: string) {
      const { sql, memberships, project } = await forChange(ctx, ref);
      const member = await sql.begin(async (tx) => {
        await lock(tx, project.id);
        const [before] = (await memberships.list('project', project.id, tx)).filter(
          (row) => row.userId === userId,
        );
        if (!before) throw new NotFoundError('This person is not a member of the project');
        if (before.roleId === roleId) return before;
        await keepAnAdmin(tx, project.id, userId);
        const after = await memberships.setRole('project', project.id, userId, roleId, tx);
        if (!after) throw new NotFoundError('This person is not a member of the project');
        await record(ctx, tx, project, 'project.members.role_changed', { before, after });
        await announce(tx, project.id, [userId]);
        return after;
      });
      return toMember(member as ContainerMember);
    },

    async remove(ctx: RequestContext, ref: string, userId: string): Promise<void> {
      const { sql, memberships, project } = await forChange(ctx, ref);
      await sql.begin(async (tx) => {
        await lock(tx, project.id);
        const [before] = (await memberships.list('project', project.id, tx)).filter(
          (row) => row.userId === userId,
        );
        if (!before) throw new NotFoundError('This person is not a member of the project');
        await keepAnAdmin(tx, project.id, userId);
        await memberships.remove('project', project.id, userId, tx);
        await record(ctx, tx, project, 'project.members.removed', { before });
        await announce(tx, project.id, [userId]);
      });
    },
  };
}

export type ProjectMembersService = ReturnType<typeof createProjectMembersService>;
