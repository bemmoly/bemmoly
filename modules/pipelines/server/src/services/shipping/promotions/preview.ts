import type { RequestContext } from '@bemmoly/core';
import type { Tier } from '../../../../../shared/common.ts';
import type { EnvironmentRef } from '../../../../../shared/environments.ts';
import type { PromotionPreview, PromotionPreviewQuery } from '../../../../../shared/promotions.ts';
import { authorizePipelines, requirePerson } from '../../deps.ts';
import { defaultPlan, presentPlan, type PlanDefaults } from '../../rollout/plan.ts';
import { approvalState } from '../approvals/state.ts';
import type { ShippingEngineDeps } from '../engine-deps.ts';
import { evaluateGates, gateCalls } from '../gates/index.ts';
import {
  authorsOf,
  loadApplication,
  loadEnvironment,
  loadRelease,
  releaseDigest,
} from '../load.ts';
import { resolveTarget } from '../targets.ts';
import { promotionTargets, requireLandedBefore } from './targets.ts';

/*
 * The Promote screen before anything is requested: the same gates, approvals and plan the
 * approver will see, whether this person may ask and whom to ask if not, the trains it
 * could join, and an open promotion of the same release to reuse. Nothing is written.
 */

const NO_PROMOTION = '00000000-0000-0000-0000-000000000000';

export async function previewPromotion(
  deps: ShippingEngineDeps,
  ctx: RequestContext,
  query: PromotionPreviewQuery,
  settings: PlanDefaults & { expiryHours: number },
): Promise<PromotionPreview> {
  await authorizePipelines(ctx);
  const person = requirePerson(ctx.actor);
  const { sql } = deps;
  const now = deps.now();
  const release = await loadRelease(sql, query.release);
  const application = await loadApplication(sql, { id: release.application_id });
  const where = await promotionTargets(sql, { tier: application.tier as Tier, to: query.to });
  const first = where.environments[0] as EnvironmentRef;
  const target = { applicationId: application.id, environmentId: first.id };
  const action = where.environmentClass === 'prod' ? 'request_prod' : 'deploy';
  const decision = await deps.access.decide(ctx, person, action, target);
  let landed: string | null = null;
  try {
    await requireLandedBefore(sql, {
      applicationId: application.id,
      releaseId: release.id,
      previousStage: where.previousStage,
      version: release.version,
    });
  } catch (error) {
    landed = (error as Error).message;
  }
  const policyVersionIds = await deps.access.policyVersionIds(sql, decision.policies);
  const requirements = await deps.access.requirements(sql, { ...target, policyVersionIds });
  const digest = releaseDigest(release);
  let metrics = null;
  try {
    const resolved = await resolveTarget(sql, deps.providers, application.id, first.id);
    metrics = resolved.provider.metrics
      ? { part: resolved.provider.metrics, target: resolved.target }
      : null;
  } catch {
    // Without a connection, gates that need metrics say they are waiting for them.
  }
  const facts = {
    now,
    promotion: {
      id: NO_PROMOTION,
      requestedBy: person,
      releaseDigest: digest,
      freezeOverride: null,
    },
    release,
    application,
    environment: await loadEnvironment(sql, first.id),
    requirements,
  };
  const gates = await evaluateGates(gateCalls(requirements.gates), facts, {
    sql,
    metrics,
    webhook: deps.webhook,
  });
  const approvals = await approvalState(sql, deps.access, {
    promotionId: NO_PROMOTION,
    target,
    rules: requirements.approvals,
    releaseDigest: digest,
    authors: authorsOf(release, person),
    viewerId: person,
    now,
  });
  const needed = approvals.requirements.reduce((sum, r) => sum + r.needed, 0);
  const refs = await sql<EnvironmentRef[]>`select id, key, name, class from pipeline_environments`;
  const plan = defaultPlan({
    tier: application.tier as Tier,
    environmentClass: where.environmentClass,
    stages: where.stages,
    defaults: settings,
  });
  const [previous] = await sql<{ id: string; version: string }[]>`
    select r.id, r.version from pipeline_current c join pipeline_releases r on r.id = c.release_id
    where c.application_id = ${application.id} and c.environment_id = ${first.id}`;
  const [existing] = await sql<{ id: string }[]>`
    select id from pipeline_promotions
    where supersede_key = ${`${application.id}:${first.id}`} and release_id = ${release.id}
      and state in ('requested', 'gating', 'awaiting_approval', 'scheduled', 'rolling_out')
    order by created_at desc limit 1`;
  const departures = await sql<{ id: string; name: string; departs_at: string; n: number }[]>`
    select d.id, t.name, d.departs_at,
      (select count(*)::int from pipeline_promotions p where p.departure_id = d.id) as n
    from pipeline_train_departures d join pipeline_trains t on t.id = d.train_id
    where d.state = 'boarding' and d.departs_at > ${now.toISOString()}::timestamptz
      and t.enabled and t.environment_class = ${where.environmentClass}
      and (t.scope_kind = 'organisation'
        or (t.scope_kind = 'domain' and t.scope_id = ${application.domain_id})
        or (t.scope_kind = 'group' and t.scope_id = ${application.group_id}))
    order by d.departs_at limit 5`;
  return {
    release: { id: release.id, version: release.version, commitSha: release.commit_sha, digest },
    previous: previous ?? null,
    application: {
      id: application.id,
      key: application.key,
      name: application.name,
      tier: application.tier as Tier,
    },
    environments: where.environments,
    gates: [
      ...gates.map(({ key: _key, ...gate }) => gate),
      {
        gate: 'approvals',
        label: 'Approvals',
        state: needed === 0 ? 'pass' : 'pending',
        reason: needed === 0 ? 'No approval needed' : `0 of ${needed} approvals`,
        evidence: { needed },
        recheckAt: null,
        evaluatedAt: now.toISOString(),
      },
    ],
    requirements: approvals.requirements,
    plan: presentPlan(plan, new Map(refs.map((ref) => [ref.key, ref]))),
    policies: requirements.policies,
    departures: departures.map((d) => ({
      id: d.id,
      trainName: d.name,
      departsAt: new Date(d.departs_at).toISOString(),
      applicationCount: d.n,
    })),
    request: {
      allowed: decision.allowed && landed === null,
      sentence: landed ?? decision.sentence,
      askWho: decision.askWho,
    },
    existingId: existing?.id ?? null,
    expiresAt: new Date(now.getTime() + settings.expiryHours * 3_600_000).toISOString(),
  };
}
