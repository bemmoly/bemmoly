import type { RequestContext } from '@bemmoly/core';
import { ConflictError, ForbiddenError, NotFoundError } from '@bemmoly/shared';
import type {
  ApprovalBody,
  CancelPromotionBody,
  FreezeOverrideBody,
} from '../../../../../shared/promotions.ts';
import type { PromotionRow } from '../../../models/shipping.ts';
import { requirePerson } from '../../deps.ts';
import { approvalState, ruleFor } from '../approvals/state.ts';
import { abortLiveDeployment } from '../deployments/actions.ts';
import type { ShippingEngineDeps } from '../engine-deps.ts';
import { authorsOf, deployActionFor, loadRelease, releaseDigest } from '../load.ts';
import { finishPromotion, publishPromotion } from './finish.ts';

/*
 * What people decide about a promotion: approve or reject it, override a freeze, cancel it.
 * Approvals come from people only, never tokens or AI, for the digest they saw, and count
 * toward a rule only when the person is one of its approvers and not an author.
 */

const BEFORE_ROLLOUT = ['requested', 'gating', 'awaiting_approval', 'scheduled'];

export async function loadPromotion(deps: ShippingEngineDeps, id: string): Promise<PromotionRow> {
  const [row] = await deps.sql<PromotionRow[]>`select * from pipeline_promotions where id = ${id}`;
  if (!row) throw new NotFoundError('That promotion does not exist');
  return row;
}

const targetOf = (row: PromotionRow) => ({
  applicationId: row.application_id,
  environmentId: row.environment_id,
});

export async function decideApproval(
  deps: ShippingEngineDeps,
  ctx: RequestContext,
  row: PromotionRow,
  body: ApprovalBody,
  validHours: number,
): Promise<void> {
  if (ctx.actor.kind !== 'user') {
    throw new ForbiddenError('Approvals come from people, not tokens or automations');
  }
  const person = requirePerson(ctx.actor);
  if (!BEFORE_ROLLOUT.includes(row.state)) {
    throw new ConflictError('This promotion is no longer waiting for approvals');
  }
  await deps.access.authorize(ctx, 'approve', targetOf(row));
  const release = await loadRelease(deps.sql, row.release_id);
  const digest = row.release_digest ?? releaseDigest(release);
  if (body.releaseDigest !== digest) {
    throw new ConflictError('The release changed since you looked at it. Review it again.');
  }
  const now = deps.now();
  const requirements = await deps.access.requirements(deps.sql, {
    ...targetOf(row),
    policyVersionIds: row.policy_versions ?? [],
  });
  const state = await approvalState(deps.sql, deps.access, {
    promotionId: row.id,
    target: targetOf(row),
    rules: requirements.approvals,
    releaseDigest: digest,
    authors: authorsOf(release, row.requested_by),
    viewerId: person,
    now,
  });
  const rule =
    body.decision === 'approved'
      ? ruleFor(state.requirements)
      : (state.requirements.find((r) => r.candidates.some((c) => c.id === person))?.requirement ??
        null);
  if (!rule) {
    const author = authorsOf(release, row.requested_by).includes(person);
    throw new ForbiddenError(
      author
        ? 'Authors and the person who asked cannot approve their own change'
        : 'You are not one of the approvers this promotion still needs',
    );
  }
  const expires = new Date(now.getTime() + validHours * 3_600_000).toISOString();
  await deps.sql.begin(async (tx) => {
    const inserted = await tx`
      insert into pipeline_approvals
        (promotion_id, user_id, requirement, decision, release_digest, comment, expires_at)
      values (${row.id}, ${person}, ${rule}, ${body.decision}, ${digest}, ${body.comment ?? null},
        ${expires}::timestamptz)
      on conflict (promotion_id, user_id) do nothing returning id`;
    if (inserted.length === 0) throw new ConflictError('You have already decided on this one');
    await publishPromotion(tx, row.id, row.state);
  });
  await deps.wake('promotion', row.id, now);
}

export async function overrideFreeze(
  deps: ShippingEngineDeps,
  ctx: RequestContext,
  row: PromotionRow,
  body: FreezeOverrideBody,
): Promise<void> {
  const person = requirePerson(ctx.actor);
  if (!BEFORE_ROLLOUT.includes(row.state)) {
    throw new ConflictError('Only a promotion that has not started can be let through a freeze');
  }
  if (!(await deps.access.isReleaseManager(ctx, person, targetOf(row)))) {
    throw new ForbiddenError('Only a Release manager can override a freeze');
  }
  const now = deps.now().toISOString();
  await deps.sql.begin(async (tx) => {
    await tx`
      update pipeline_promotions
      set freeze_override = ${JSON.stringify({ by: person, reason: body.reason, at: now })}::jsonb,
        next_check_at = ${now}::timestamptz, updated_at = ${now}::timestamptz
      where id = ${row.id}`;
    await tx`
      insert into pipeline_changes
        (kind, application_id, environment_id, domain_id, group_id, actor_user_id, summary,
         detail, ref_kind, ref_id, occurred_at)
      select 'policy', a.id, ${row.environment_id}, a.domain_id, a.group_id, ${person},
        'Freeze overridden for ' || a.key || ' ' || r.version, ${body.reason}, 'promotion',
        ${row.id}, ${now}::timestamptz
      from pipeline_applications a join pipeline_releases r on r.id = ${row.release_id}
      where a.id = ${row.application_id}`;
    await publishPromotion(tx, row.id, row.state);
  });
  await deps.wake('promotion', row.id, deps.now());
}

export async function cancelPromotion(
  deps: ShippingEngineDeps,
  ctx: RequestContext,
  row: PromotionRow,
  body: CancelPromotionBody,
): Promise<void> {
  requirePerson(ctx.actor);
  await deps.access.authorize(
    ctx,
    await deployActionFor(deps.sql, row.environment_id),
    targetOf(row),
  );
  if (![...BEFORE_ROLLOUT, 'rolling_out'].includes(row.state)) {
    throw new ConflictError('This promotion has already finished');
  }
  const reason = body.reason?.trim() || 'Cancelled';
  if (row.state === 'rolling_out') {
    const live = await deps.sql<{ id: string }[]>`
      select id from pipeline_deployments where promotion_id = ${row.id}
        and state in ('pending', 'deploying', 'canary', 'waiting')`;
    for (const deployment of live) await abortLiveDeployment(deps, deployment.id, reason);
  }
  await deps.sql.begin((tx) => finishPromotion(tx, row.id, 'cancelled', reason, deps.now()));
}
