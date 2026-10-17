import type { RequestContext, SqlClient } from '@bemmoly/core';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@bemmoly/shared';
import type {
  CreatePolicyBody,
  PoliciesResponse,
  Policy,
  PolicyRequirements,
  PolicyVersionsResponse,
  updatePolicyBodySchema,
} from '../../../../shared/access.ts';
import { policyRequirementsSchema } from '../../../../shared/access.ts';
import type { ScopeRef } from '../../../../shared/common.ts';
import type { PolicyRow, PolicyVersionRow } from '../../models/access.ts';
import { requirePerson } from '../deps.ts';
import { checkCel } from './cel.ts';
import type { AccessEngine } from './engine.ts';
import { presentPolicy, presentVersion, type PendingRow } from './policy-present.ts';
import { namedScope, pathOfScopePath, pathOfScopeRef, targetOfPath } from './scopes.ts';
import { policySentence, policySource } from './sentence.ts';
import { appliesToTier0 } from './tier0.ts';
import { parseWindow } from './window.ts';

/*
 * Policies are versioned (architecture §10.2). A change to a policy that applies to Tier 0,
 * before or after the change, is stored as a pending version and takes effect only when a
 * second Platform admin approves it; any other change takes effect at once. A Tier 0 policy
 * cannot be switched off directly, since that would skip the second person.
 */

type UpdateBody = ReturnType<typeof updatePolicyBodySchema.parse>;

function validate(applies: string, requirements: PolicyRequirements): void {
  const problems: Record<string, string> = {};
  const applied = checkCel(applies);
  if (!applied.ok) problems.applies = applied.error;
  if (requirements.requester) {
    const requester = checkCel(requirements.requester);
    if (!requester.ok) problems['requirements.requester'] = requester.error;
  }
  if (requirements.denyIf) {
    const denyIf = checkCel(requirements.denyIf);
    if (!denyIf.ok) problems['requirements.denyIf'] = denyIf.error;
  }
  if (requirements.window) {
    const window = parseWindow(requirements.window);
    if (!window.ok) problems['requirements.window'] = window.error;
  }
  const first = Object.entries(problems)[0];
  if (first) {
    throw new ValidationError(`${first[0]}: ${first[1]}`, { details: { fields: problems } });
  }
}

async function teamNames(sql: SqlClient, requirements: PolicyRequirements) {
  const ids = requirements.approvals
    .map((approval) => approval.from)
    .filter((from) => from.startsWith('team:'))
    .map((from) => from.slice(5));
  if (ids.length === 0) return new Map<string, string>();
  const rows = await sql<{ id: string; name: string }[]>`
    select id, name from teams where id = any(${ids}::uuid[])`;
  return new Map(rows.map((row) => [row.id, row.name]));
}

const POLICY_SELECT = `
  p.id, p.key, p.name, p.scope_kind, p.scope_id, null as scope_name, p.current_version,
  p.enabled, p.source_repository, p.updated_at,
  coalesce(v.applies, '') as applies, coalesce(v.requirements, '{}'::jsonb) as requirements,
  coalesce(v.sentence, '') as sentence, coalesce(v.source, '') as source`;

export function createPoliciesService(sql: () => SqlClient, engine: AccessEngine) {
  async function pending(ids: readonly string[]): Promise<Map<string, PendingRow>> {
    if (ids.length === 0) return new Map();
    const rows = await sql()<PendingRow[]>`
      select v.policy_id, v.version, v.sentence, v.applies, v.requirements, v.source,
        v.created_by, u.name as created_by_name,
        v.created_at
      from pipeline_policy_versions v
        join pipeline_policies p on p.id = v.policy_id
        left join users u on u.id = v.created_by
      where v.policy_id = any(${ids}::uuid[]) and v.version > p.current_version
        and v.approved_at is null`;
    return new Map(rows.map((row) => [row.policy_id, row]));
  }

  async function present(rows: readonly PolicyRow[]): Promise<Policy[]> {
    const root = await engine.organisation();
    const waiting = await pending(rows.map((row) => row.id));
    const paths = new Map<string, Awaited<ReturnType<typeof pathOfScopeRef>>>();
    const policies: Policy[] = [];
    for (const row of rows) {
      const ref: ScopeRef = {
        kind: row.scope_kind as ScopeRef['kind'],
        ...(row.scope_id ? { id: row.scope_id } : {}),
      };
      const key = `${ref.kind}:${ref.id ?? ''}`;
      const path = paths.get(key) ?? (await pathOfScopeRef(sql(), ref, root));
      paths.set(key, path);
      const node = path.at(-1) ?? root;
      policies.push(presentPolicy(row, namedScope(node, path), waiting.get(row.id) ?? null));
    }
    return policies;
  }

  async function load(id: string): Promise<PolicyRow> {
    const [row] = await sql()<PolicyRow[]>`
      select ${sql().unsafe(POLICY_SELECT)} from pipeline_policies p
        left join pipeline_policy_versions v on v.policy_id = p.id and v.version = p.current_version
      where p.id = ${id}::uuid`;
    if (!row) throw new NotFoundError('No such policy');
    return row;
  }

  async function authorizePolicy(ctx: RequestContext, scope: ScopeRef) {
    const path = await pathOfScopeRef(sql(), scope, await engine.organisation());
    await engine.authorizeAction(ctx, 'platform', targetOfPath(path));
  }

  /** Writes version `version`; Tier 0 changes wait, others take effect now. */
  async function writeVersion(
    ctx: RequestContext,
    policy: { id: string; key: string; name: string; current: number; oldApplies: string | null },
    applies: string,
    requirements: PolicyRequirements,
  ): Promise<void> {
    const db = sql();
    const person = requirePerson(ctx.actor);
    const tier0 = await appliesToTier0(db, [
      applies,
      ...(policy.oldApplies ? [policy.oldApplies] : []),
    ]);
    const sentence = policySentence(requirements, await teamNames(db, requirements));
    const source = policySource({ key: policy.key, name: policy.name, applies, requirements });
    await db.begin(async (tx) => {
      // One change waits at a time: a newer edit replaces the one not yet approved.
      await tx`delete from pipeline_policy_versions
        where policy_id = ${policy.id}::uuid and version > ${policy.current} and approved_at is null`;
      const version = policy.current + 1;
      await tx`
        insert into pipeline_policy_versions
          (policy_id, version, applies, requirements, sentence, source, created_by)
        values (${policy.id}::uuid, ${version}, ${applies}, ${JSON.stringify(requirements)}::jsonb,
          ${sentence}, ${source}, ${person}::uuid)`;
      if (!tier0) {
        await tx`update pipeline_policies set current_version = ${version}, updated_at = now()
          where id = ${policy.id}::uuid`;
      }
    });
  }

  return {
    async list(ctx: RequestContext, scope: string | undefined): Promise<PoliciesResponse> {
      await engine.authorizeAction(ctx, 'view', {});
      const db = sql();
      const path = scope ? await pathOfScopePath(db, scope, await engine.organisation()) : null;
      const onPath = path
        ? path
            .map((node) =>
              node.kind === 'organisation'
                ? db`p.scope_kind = 'organisation'`
                : db`(p.scope_kind = ${node.kind} and p.scope_id = ${node.id}::uuid)`,
            )
            .reduce((all, condition) => db`${all} or ${condition}`)
        : db`true`;
      const rows = await db<PolicyRow[]>`
        select ${db.unsafe(POLICY_SELECT)} from pipeline_policies p
          left join pipeline_policy_versions v
            on v.policy_id = p.id and v.version = p.current_version
        where ${onPath}
        order by lower(p.name), p.id`;
      return { items: await present(rows) };
    },

    async versions(ctx: RequestContext, id: string): Promise<PolicyVersionsResponse> {
      await engine.authorizeAction(ctx, 'view', {});
      await load(id);
      const rows = await sql()<PolicyVersionRow[]>`
        select v.*, cu.name as created_by_name, au.name as approved_by_name
        from pipeline_policy_versions v
          left join users cu on cu.id = v.created_by
          left join users au on au.id = v.approved_by
        where v.policy_id = ${id}::uuid order by v.version desc`;
      return { items: rows.map(presentVersion) };
    },

    async create(ctx: RequestContext, body: CreatePolicyBody): Promise<Policy> {
      const requirements = policyRequirementsSchema.parse(body.requirements);
      await authorizePolicy(ctx, body.scope);
      validate(body.applies, requirements);
      const rows = await sql()<{ id: string }[]>`
        insert into pipeline_policies (key, name, scope_kind, scope_id, current_version)
        values (${body.key}, ${body.name}, ${body.scope.kind}, ${body.scope.id ?? null}::uuid, 0)
        on conflict (key) do nothing returning id`;
      const id = rows[0]?.id;
      if (!id) throw new ConflictError(`A policy called "${body.key}" already exists`);
      const policy = { id, key: body.key, name: body.name, current: 0, oldApplies: null };
      await writeVersion(ctx, policy, body.applies, requirements);
      return (await present([await load(id)]))[0] as Policy;
    },

    async update(ctx: RequestContext, id: string, body: UpdateBody): Promise<Policy> {
      const row = await load(id);
      const scope = body.scope ?? {
        kind: row.scope_kind as ScopeRef['kind'],
        ...(row.scope_id ? { id: row.scope_id } : {}),
      };
      await authorizePolicy(ctx, {
        kind: row.scope_kind as ScopeRef['kind'],
        ...(row.scope_id ? { id: row.scope_id } : {}),
      });
      if (body.scope) await authorizePolicy(ctx, scope);
      const db = sql();
      if (body.enabled === false && row.enabled && (await appliesToTier0(db, [row.applies]))) {
        throw new ValidationError(
          'A policy that applies to Tier 0 cannot be switched off directly. Change what it applies to instead; a second Platform admin approves that.',
        );
      }
      await db`
        update pipeline_policies set
          name = ${body.name ?? row.name}, enabled = ${body.enabled ?? row.enabled},
          scope_kind = ${scope.kind}, scope_id = ${scope.id ?? null}::uuid, updated_at = now()
        where id = ${id}::uuid`;
      if (body.applies !== undefined || body.requirements !== undefined) {
        const applies = body.applies ?? row.applies;
        const requirements = body.requirements
          ? policyRequirementsSchema.parse(body.requirements)
          : policyRequirementsSchema.parse(row.requirements ?? {});
        validate(applies, requirements);
        const policy = {
          id,
          key: row.key,
          name: body.name ?? row.name,
          current: row.current_version,
          oldApplies: row.current_version > 0 ? row.applies : null,
        };
        await writeVersion(ctx, policy, applies, requirements);
      }
      return (await present([await load(id)]))[0] as Policy;
    },

    /** The second Platform admin's approval of a waiting Tier 0 change. */
    async approve(ctx: RequestContext, id: string, version: number): Promise<Policy> {
      const row = await load(id);
      await authorizePolicy(ctx, {
        kind: row.scope_kind as ScopeRef['kind'],
        ...(row.scope_id ? { id: row.scope_id } : {}),
      });
      const person = requirePerson(ctx.actor);
      const db = sql();
      const [waiting] = await db<{ created_by: string | null }[]>`
        select created_by from pipeline_policy_versions
        where policy_id = ${id}::uuid and version = ${version} and approved_at is null
          and version > ${row.current_version}`;
      if (!waiting) throw new NotFoundError('No change to this policy is waiting for approval');
      if (waiting.created_by === person) {
        throw new ForbiddenError('A second Platform admin must approve this change; you made it.');
      }
      await db.begin(async (tx) => {
        await tx`update pipeline_policy_versions set approved_by = ${person}::uuid,
            approved_at = now(), updated_at = now()
          where policy_id = ${id}::uuid and version = ${version}`;
        await tx`update pipeline_policies set current_version = ${version}, updated_at = now()
          where id = ${id}::uuid`;
      });
      return (await present([await load(id)]))[0] as Policy;
    },
  };
}

export type PoliciesService = ReturnType<typeof createPoliciesService>;
