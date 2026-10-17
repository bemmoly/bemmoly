import type { RequestContext, SqlClient } from '@bemmoly/core';
import { ConflictError, NotFoundError, ValidationError } from '@bemmoly/shared';
import type {
  BindingsResponse,
  CreateBindingBody,
  RoleBinding,
} from '../../../../shared/access.ts';
import type { listBindingsQuerySchema } from '../../../../shared/access.ts';
import type { BindingRow } from '../../models/access.ts';
import { isoOrNull } from '../../utils/time.ts';
import { requirePerson } from '../deps.ts';
import type { AccessEngine } from './engine.ts';
import { BINDING_COLUMNS, BINDING_FROM, toBindingFact } from './facts.ts';
import { namedScope, pathOfScopePath, pathOfScopeRef, targetOfPath } from './scopes.ts';
import type { ScopeNode } from './types.ts';

type ListBindingsQuery = ReturnType<typeof listBindingsQuerySchema.parse>;

/*
 * Role bindings on the Access screen: the ones at a scope, those inherited from wider
 * scopes, and the owning team's implicit Maintainer. Binding a team at a scope needs
 * Maintainer there; the organisation, Platform admin and break-glass bindings for one
 * person need a Platform admin.
 */

const sameNode = (a: ScopeNode, b: ScopeNode) => a.kind === b.kind && a.id === b.id;

function present(row: BindingRow, path: readonly ScopeNode[], target: ScopeNode): RoleBinding {
  const fact = toBindingFact(row, path);
  const inherited = !sameNode(fact.scope, target);
  return {
    id: row.id,
    subject:
      row.subject_kind === 'team'
        ? { kind: 'team', team: { id: row.subject_id, name: fact.subject.name } }
        : { kind: 'user', user: { id: row.subject_id, name: fact.subject.name, avatarUrl: null } },
    role: fact.role,
    scope: namedScope(fact.scope, path),
    environmentClass: fact.environmentClass,
    expiresAt: isoOrNull(row.expires_at),
    reason: row.reason,
    inherited,
    inheritedFrom: inherited ? namedScope(fact.scope, path) : null,
    implicit: false,
    createdBy: row.created_by ? { id: row.created_by, name: row.created_by_name ?? '' } : null,
    createdAt: isoOrNull(row.created_at),
  };
}

export function createBindingsService(sql: () => SqlClient, engine: AccessEngine) {
  async function pathFor(query: ListBindingsQuery): Promise<ScopeNode[]> {
    const root = await engine.organisation();
    if (query.application) {
      return pathOfScopeRef(sql(), { kind: 'application', id: query.application }, root);
    }
    return pathOfScopePath(sql(), query.scope, root);
  }

  async function authorizeChange(
    ctx: RequestContext,
    path: readonly ScopeNode[],
    wide: boolean,
  ): Promise<void> {
    if (wide) await engine.authorizeAction(ctx, 'platform', {});
    else await engine.authorizeAction(ctx, 'manage', targetOfPath(path));
  }

  return {
    async list(ctx: RequestContext, query: ListBindingsQuery): Promise<BindingsResponse> {
      const path = await pathFor(query);
      await engine.authorizeAction(ctx, 'view', targetOfPath(path));
      const target = path.at(-1) as ScopeNode;
      const db = sql();
      const scopes = query.inherited ? path : [target];
      const conditions = scopes.map((node) =>
        node.kind === 'organisation'
          ? db`b.scope_kind = 'organisation'`
          : db`(b.scope_kind = ${node.kind} and b.scope_id = ${node.id}::uuid)`,
      );
      const where = conditions.reduce((all, condition) => db`${all} or ${condition}`);
      const rows = await db<BindingRow[]>`
        select ${db.unsafe(BINDING_COLUMNS)} from ${db.unsafe(BINDING_FROM)}
        where (${where}) and (b.expires_at is null or b.expires_at > now())
        order by case b.scope_kind when 'application' then 0 when 'group' then 1
          when 'domain' then 2 else 3 end, b.role, lower(coalesce(t.name, u.name))`;
      const items = rows.map((row) => present(row, path, target));
      if (target.kind === 'application' && target.id) {
        const [owner] = await db<{ id: string; name: string }[]>`
          select t.id, t.name from pipeline_applications a join teams t on t.id = a.owner_team_id
          where a.id = ${target.id}::uuid`;
        if (owner) {
          items.unshift({
            id: null,
            subject: { kind: 'team', team: owner },
            role: 'maintainer',
            scope: namedScope(target, path),
            environmentClass: null,
            expiresAt: null,
            reason: null,
            inherited: false,
            inheritedFrom: null,
            implicit: true,
            createdBy: null,
            createdAt: null,
          });
        }
      }
      const column = { domain: 'domain_id', group: 'group_id', application: 'id' } as const;
      const [count] = await db<{ teams: number }[]>`
        select count(distinct owner_team_id)::int as teams from pipeline_applications
        where archived_at is null
          ${target.kind === 'organisation' ? db`` : db`and ${db(column[target.kind])} = ${target.id}::uuid`}`;
      return { items, owningTeams: count?.teams ?? 0 };
    },

    async create(ctx: RequestContext, body: CreateBindingBody): Promise<RoleBinding> {
      const root = await engine.organisation();
      const path = await pathOfScopeRef(sql(), body.scope, root);
      const wide =
        body.scope.kind === 'organisation' ||
        body.subject.kind === 'user' ||
        body.role === 'platform_admin';
      await authorizeChange(ctx, path, wide);
      if (body.expiresAt && Date.parse(body.expiresAt) <= Date.now()) {
        throw new ValidationError('The end time is already past', {
          details: { path: ['expiresAt'] },
        });
      }
      const db = sql();
      const [subject] =
        body.subject.kind === 'team'
          ? await db<{ id: string }[]>`select id from teams where id = ${body.subject.id}::uuid`
          : await db<{ id: string }[]>`select id from users where id = ${body.subject.id}::uuid`;
      if (!subject)
        throw new NotFoundError(`No such ${body.subject.kind === 'team' ? 'team' : 'person'}`);
      const target = path.at(-1) as ScopeNode;
      const rows = await db<{ id: string }[]>`
        insert into pipeline_role_bindings
          (subject_kind, subject_id, role, scope_kind, scope_id, environment_class, expires_at,
           reason, created_by)
        values (${body.subject.kind}, ${body.subject.id}::uuid, ${body.role}, ${target.kind},
          ${target.id}::uuid, ${body.environmentClass ?? null}, ${body.expiresAt ?? null}::timestamptz,
          ${body.reason ?? null}, ${requirePerson(ctx.actor)}::uuid)
        on conflict do nothing
        returning id`;
      const id = rows[0]?.id;
      if (!id) throw new ConflictError('That team or person already has this role here');
      const [row] = await db<BindingRow[]>`
        select ${db.unsafe(BINDING_COLUMNS)} from ${db.unsafe(BINDING_FROM)} where b.id = ${id}::uuid`;
      if (!row) throw new NotFoundError('The binding was removed while it was being added');
      return present(row, path, target);
    },

    async remove(ctx: RequestContext, id: string): Promise<void> {
      const db = sql();
      const [row] = await db<BindingRow[]>`
        select ${db.unsafe(BINDING_COLUMNS)} from ${db.unsafe(BINDING_FROM)} where b.id = ${id}::uuid`;
      if (!row) throw new NotFoundError('No such binding');
      const root = await engine.organisation();
      const path = await pathOfScopeRef(
        db,
        {
          kind: row.scope_kind as ScopeNode['kind'],
          ...(row.scope_id ? { id: row.scope_id } : {}),
        },
        root,
      );
      const wide =
        row.scope_kind === 'organisation' ||
        row.subject_kind === 'user' ||
        row.role === 'platform_admin';
      await authorizeChange(ctx, path, wide);
      await db`delete from pipeline_role_bindings where id = ${id}::uuid`;
    },
  };
}

export type BindingsService = ReturnType<typeof createBindingsService>;
