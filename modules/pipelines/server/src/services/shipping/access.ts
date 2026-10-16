import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import type { AccessAction, PolicyRequirements } from '../../../../shared/access.ts';
import type { PersonRef } from '../../../../shared/common.ts';
import type { AccessEngine, MatchedPolicy } from '../access/index.ts';
import { authorizePipelines } from '../deps.ts';

/*
 * What shipping asks of access and policy (architecture §10). The access engine decides who
 * may request, approve and roll back, and which policies apply; a promotion records the
 * policy versions that applied when it was requested, so its requirements never shift under
 * it when a policy is edited later. Without a matching policy, an environment's own
 * protection decides: protected environments need one approval from the owning team.
 */

export interface ShippingTarget {
  applicationId: string;
  environmentId: string | null;
}

export interface ApprovalRule {
  /** "owning_team", "team:<id>", "oncall:<key>", "role:release_manager". */
  requirement: string;
  label: string;
  count: number;
  excludeAuthors: boolean;
}

export interface ShippingRequirements {
  approvals: ApprovalRule[];
  /** Gate calls as policies write them: tests, staging_healthy("30m"), webhook("opa"). */
  gates: string[];
  window: string | null;
  policies: Array<{ id: string; name: string; version: number }>;
}

export interface ShippingAccess {
  /** Throws ForbiddenError with the sentence, trace and whom to ask; returns matched policies. */
  authorize(
    ctx: RequestContext,
    action: AccessAction,
    target: ShippingTarget,
  ): Promise<{ policies: MatchedPolicy[] }>;
  /** The policy version rows behind matched policies, to store on a promotion. */
  policyVersionIds(sql: SqlExecutor, policies: readonly MatchedPolicy[]): Promise<string[]>;
  requirements(
    sql: SqlExecutor,
    target: { applicationId: string; environmentId: string; policyVersionIds: readonly string[] },
  ): Promise<ShippingRequirements>;
  candidates(sql: SqlExecutor, rule: ApprovalRule, target: ShippingTarget): Promise<PersonRef[]>;
  /** Release managers may override a freeze; Platform admins count as one. */
  isReleaseManager(ctx: RequestContext, userId: string, target: ShippingTarget): Promise<boolean>;
}

interface TargetFacts {
  owner_team_id: string | null;
  owner_team_name: string | null;
  domain_id: string;
  group_id: string;
  environment_class: string | null;
  protection: Record<string, unknown> | null;
}

async function factsOf(sql: SqlExecutor, target: ShippingTarget): Promise<TargetFacts | null> {
  const [row] = await sql<TargetFacts[]>`
    select a.owner_team_id, t.name as owner_team_name, a.domain_id, a.group_id,
      e.class as environment_class, e.protection
    from pipeline_applications a
    left join teams t on t.id = a.owner_team_id
    left join pipeline_environments e on e.id = ${target.environmentId}::uuid
    where a.id = ${target.applicationId}`;
  return row ?? null;
}

const toTarget = (target: ShippingTarget) => ({
  application: target.applicationId,
  ...(target.environmentId ? { environment: target.environmentId } : {}),
});

async function ruleLabel(
  sql: SqlExecutor,
  from: string,
  count: number,
  facts: TargetFacts | null,
): Promise<string> {
  const [kind, value = ''] = from.split(':');
  if (kind === 'owning_team') return `${count} from ${facts?.owner_team_name ?? 'the owners'}`;
  if (kind === 'team') {
    const [team] = await sql<{ name: string }[]>`select name from teams where id = ${value}`;
    return `${count} from ${team?.name ?? 'a team'}`;
  }
  if (kind === 'oncall') return `${count} from ${value} on call`;
  return `${count} ${value.replace('_', ' ')}`;
}

function defaultsFor(facts: TargetFacts | null): Pick<ShippingRequirements, 'gates'> & {
  approve: boolean;
} {
  const protection = facts?.protection ?? {};
  const environmentClass = facts?.environment_class ?? 'dev';
  return {
    approve: protection['requiresApproval'] === true || environmentClass === 'prod',
    gates: environmentClass === 'dev' ? [] : ['tests', 'external_checks'],
  };
}

async function roleCandidates(
  sql: SqlExecutor,
  role: string,
  facts: TargetFacts,
  applicationId: string,
): Promise<PersonRef[]> {
  return sql<PersonRef[]>`
    select distinct u.id, u.name, null as "avatarUrl"
    from pipeline_role_bindings b
    left join team_members m on b.subject_kind = 'team' and m.team_id = b.subject_id
    join users u on u.id = coalesce(m.user_id, case when b.subject_kind = 'user' then b.subject_id end)
    where b.role = ${role} and (b.expires_at is null or b.expires_at > now())
      and (b.environment_class is null or b.environment_class = ${facts.environment_class})
      and (b.scope_kind = 'organisation'
        or (b.scope_kind = 'domain' and b.scope_id = ${facts.domain_id})
        or (b.scope_kind = 'group' and b.scope_id = ${facts.group_id})
        or (b.scope_kind = 'application' and b.scope_id = ${applicationId}))
    order by u.name`;
}

export function createShippingAccess(engine?: AccessEngine): ShippingAccess {
  return {
    async authorize(ctx, action, target) {
      if (!engine) {
        await authorizePipelines(
          ctx,
          action === 'approve' ? 'pipelines.approve' : 'pipelines.deploy',
        );
        return { policies: [] };
      }
      const decision = await engine.authorizeAction(ctx, action, toTarget(target));
      return { policies: decision.policies };
    },

    async policyVersionIds(sql, policies) {
      if (policies.length === 0) return [];
      const wanted = JSON.stringify(policies.map((p) => ({ id: p.id, version: p.version })));
      const rows = await sql<{ id: string }[]>`
        select v.id from pipeline_policy_versions v
        join jsonb_to_recordset(${wanted}::jsonb) as m(id uuid, version int)
          on m.id = v.policy_id and m.version = v.version`;
      return rows.map((row) => row.id);
    },

    async requirements(sql, target) {
      const facts = await factsOf(sql, target);
      const protection = facts?.protection ?? {};
      const ownWindow = typeof protection['window'] === 'string' ? protection['window'] : null;
      const versions = await sql<
        { id: string; name: string; version: number; requirements: PolicyRequirements }[]
      >`
        select p.id, p.name, v.version, v.requirements from pipeline_policy_versions v
        join pipeline_policies p on p.id = v.policy_id
        where v.id = any(${target.policyVersionIds as string[]}::uuid[]) order by p.key`;
      if (versions.length === 0) {
        const fallback = defaultsFor(facts);
        const label = await ruleLabel(sql, 'owning_team', 1, facts);
        return {
          approvals: fallback.approve
            ? [{ requirement: 'owning_team', label, count: 1, excludeAuthors: true }]
            : [],
          gates: fallback.gates,
          window: ownWindow,
          policies: [],
        };
      }
      const approvals: ApprovalRule[] = [];
      const gates: string[] = [];
      let window = ownWindow;
      for (const { requirements } of versions) {
        for (const rule of requirements.approvals ?? []) {
          const excludeAuthors = (rule.exclude ?? []).includes('authors');
          const existing = approvals.find((a) => a.requirement === rule.from);
          const count = Math.max(existing?.count ?? 0, rule.count);
          const label = await ruleLabel(sql, rule.from, count, facts);
          if (existing)
            Object.assign(existing, {
              count,
              label,
              excludeAuthors: existing.excludeAuthors || excludeAuthors,
            });
          else approvals.push({ requirement: rule.from, label, count, excludeAuthors });
        }
        gates.push(...(requirements.gates ?? []));
        window ??= requirements.window ?? null;
      }
      const policies = versions.map(({ id, name, version }) => ({ id, name, version }));
      return { approvals, gates, window, policies };
    },

    async candidates(sql, rule, target) {
      const facts = await factsOf(sql, target);
      if (!facts) return [];
      const [kind, value = ''] = rule.requirement.split(':');
      if (kind === 'owning_team' || kind === 'team') {
        const team = kind === 'team' ? value : facts.owner_team_id;
        if (!team) return [];
        return sql<PersonRef[]>`
          select u.id, u.name, null as "avatarUrl" from team_members m
          join users u on u.id = m.user_id where m.team_id = ${team} order by u.name`;
      }
      if (kind === 'oncall') {
        return sql<PersonRef[]>`
          select distinct u.id, u.name, null as "avatarUrl" from pipeline_oncall o
          join users u on u.id = o.user_id
          where o.schedule_key = ${value} and o.starts_at <= now() and o.ends_at > now()
          order by u.name`;
      }
      return kind === 'role' ? roleCandidates(sql, value, facts, target.applicationId) : [];
    },

    async isReleaseManager(ctx, userId, target) {
      if (!engine) return false;
      const decision = await engine.decideFor(ctx, userId, 'approve', toTarget(target));
      return decision.roles.some((role) => role === 'release_manager' || role === 'platform_admin');
    },
  };
}
