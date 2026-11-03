import type { RequestContext } from '@bemmoly/core';
import { ValidationError } from '@bemmoly/shared';
import type { Tier } from '../../../../../shared/common.ts';
import type { CreatePromotionBody } from '../../../../../shared/promotions.ts';
import type { RolloutPlan } from '../../../../../shared/promotions.ts';
import { requirePerson } from '../../deps.ts';
import { defaultPlan, narrowPlan, type PlanDefaults } from '../../rollout/plan.ts';
import type { ShippingEngineDeps } from '../engine-deps.ts';
import { loadApplication, loadRelease, releaseDigest } from '../load.ts';
import { finishPromotion, publishPromotion } from './finish.ts';
import { promotionTargets, requireLandedBefore } from './targets.ts';

/*
 * Requesting a promotion: who may (the access engine, with request_prod for Prod), where
 * to (the path), how (the default plan, narrowed only toward more care), and what it is
 * held to (the policy versions that applied at this moment). An open promotion of an older
 * release to the same place is superseded; asking twice for the same one returns it.
 */

export interface RequestSettings extends PlanDefaults {
  expiryHours: number;
}

type RequestBody = CreatePromotionBody & { mode: NonNullable<CreatePromotionBody['mode']> };

export async function requestPromotion(
  deps: ShippingEngineDeps,
  ctx: RequestContext,
  body: RequestBody,
  settings: RequestSettings,
): Promise<{ id: string; created: boolean }> {
  const person = requirePerson(ctx.actor);
  return recordPromotion(deps, body, settings, async (where, applicationId) => {
    await requireNoApprovalRule(
      deps.sql,
      where.environments.map((e) => e.id),
    );
    const action = where.environmentClass === 'prod' ? 'request_prod' : 'deploy';
    const { policies } = await deps.access.authorize(ctx, action, {
      applicationId,
      environmentId: where.environments[0]?.id ?? '',
    });
    return { person, policyVersions: await deps.access.policyVersionIds(deps.sql, policies) };
  });
}

/**
 * Asked for by the path or a pipeline's deploy step, not a person, so nobody is named. It never
 * reaches an environment with an approval rule (only a change request does), and gates and
 * bake time hold it exactly as they hold a person's request.
 */
export async function requestAutomatically(
  deps: ShippingEngineDeps,
  body: RequestBody,
  settings: RequestSettings,
): Promise<{ id: string; created: boolean }> {
  return recordPromotion(deps, body, settings, async (where) => {
    await requireNoApprovalRule(
      deps.sql,
      where.environments.map((e) => e.id),
    );
    return { person: null, policyVersions: [] };
  });
}

/**
 * Started by a change request once its last approval landed (or by a Platform admin's
 * emergency deploy): the people it names already approved, so the promotion is recorded for
 * the person who asked, skips the approval gate and is not held to the older path check;
 * the request checked which versions may go when it was sent.
 */
export async function requestForChangeRequest(
  deps: ShippingEngineDeps,
  body: RequestBody & { changeRequestId: string; requestedBy: string | null },
  settings: RequestSettings,
): Promise<{ id: string; created: boolean }> {
  return recordPromotion(
    deps,
    body,
    settings,
    async () => ({ person: body.requestedBy, policyVersions: [] }),
    { changeRequestId: body.changeRequestId },
  );
}

/** An environment with an approval rule takes versions only through a change request. */
async function requireNoApprovalRule(sql: ShippingEngineDeps['sql'], ids: readonly string[]) {
  const [ruled] = await sql<{ name: string }[]>`
    select name from pipeline_environments
    where id = any(${ids as string[]}::uuid[]) and approval_rule is not null limit 1`;
  if (ruled) {
    throw new ValidationError(
      `${ruled.name} has an approval rule. Write a change request to deploy there.`,
    );
  }
}

type Requester = (
  where: Awaited<ReturnType<typeof promotionTargets>>,
  applicationId: string,
) => Promise<{ person: string | null; policyVersions: string[] }>;

async function recordPromotion(
  deps: ShippingEngineDeps,
  body: RequestBody,
  settings: RequestSettings,
  requester: Requester,
  options: { changeRequestId?: string } = {},
): Promise<{ id: string; created: boolean }> {
  const { sql } = deps;
  const release = await loadRelease(sql, body.release);
  const application = await loadApplication(sql, { id: release.application_id });
  const where = await promotionTargets(sql, { tier: application.tier as Tier, to: body.to });
  const first = where.environments[0];
  if (!first) throw new ValidationError('Name an environment to promote to');
  const { person, policyVersions } = await requester(where, application.id);
  if (!options.changeRequestId)
    await requireLandedBefore(sql, {
      applicationId: application.id,
      releaseId: release.id,
      previousStage: where.previousStage,
      version: release.version,
    });
  if (body.mode === 'train' && !body.departure) {
    throw new ValidationError('Pick the train departure to join');
  }
  const plan = narrowPlan(
    defaultPlan({
      tier: application.tier as Tier,
      environmentClass: where.environmentClass,
      stages: where.stages,
      defaults: settings,
    }),
    body.plan as Partial<RolloutPlan> | undefined,
  );
  const now = deps.now();
  const at = now.toISOString();
  // Approved already: nothing is left for it to wait on that could expire.
  const expires = options.changeRequestId
    ? null
    : new Date(now.getTime() + settings.expiryHours * 3_600_000).toISOString();
  const changeRequestId = options.changeRequestId ?? null;
  const supersedeKey = `${application.id}:${first.id}`;

  const result = await sql.begin(async (tx) => {
    const open = await tx<{ id: string; release_id: string }[]>`
      select id, release_id from pipeline_promotions
      where supersede_key = ${supersedeKey}
        and state in ('requested', 'gating', 'awaiting_approval', 'scheduled')
      for update`;
    const same = open.find((row) => row.release_id === release.id);
    if (same) return { id: same.id, created: false };
    for (const older of open) {
      await finishPromotion(tx, older.id, 'cancelled', `Superseded by ${release.version}`, now);
    }
    const [row] = await tx<{ id: string }[]>`
      insert into pipeline_promotions
        (release_id, application_id, environment_id, mode, departure_id, state, plan,
         policy_versions, supersede_key, requested_by, release_digest, expires_at, note,
         change_request_id, next_check_at, created_at, updated_at)
      values (${release.id}, ${application.id}, ${first.id}, ${body.mode},
        ${body.departure ?? null}, 'requested', ${JSON.stringify(plan)}::jsonb,
        ${policyVersions}::uuid[], ${supersedeKey}, ${person}, ${releaseDigest(release)},
        ${expires}::timestamptz, ${body.note ?? null}, ${changeRequestId}::uuid,
        ${at}::timestamptz, ${at}::timestamptz, ${at}::timestamptz)
      returning id`;
    if (!row) throw new Error('The promotion was not recorded');
    await publishPromotion(tx, row.id, 'requested');
    return { id: row.id, created: true };
  });
  return result;
}
