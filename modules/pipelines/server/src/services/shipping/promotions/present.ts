import type { SqlExecutor } from '@bemmoly/core';
import type {
  EnvironmentClass,
  PromotionMode,
  PromotionState,
  Tier,
} from '../../../../../shared/common.ts';
import type { EnvironmentRef } from '../../../../../shared/environments.ts';
import type { Gate, GateState, Promotion } from '../../../../../shared/promotions.ts';
import type { ApprovalRow, GateResultRow, PromotionRow } from '../../../models/shipping.ts';
import { iso, isoOrNull } from '../../../utils/time.ts';
import { presentPlan, readPlan } from '../../rollout/plan.ts';
import type { ShippingAccess } from '../access.ts';
import { approvalState } from '../approvals/state.ts';
import { authorsOf, loadRelease, releaseDigest } from '../load.ts';

/*
 * A promotion as the Promote screen and the approvals inbox show it: the same gates,
 * approvals and plan for the person asking and the person approving, with whether this
 * viewer may approve each rule.
 */

const GATE_LABELS: Readonly<Record<string, string>> = {
  tests: 'Tests',
  external_checks: 'External checks',
  security_scan: 'Security scan',
  staging_healthy: 'Healthy in Staging',
  window: 'Deploy window',
  freeze: 'No freeze',
  approvals: 'Approvals',
  error_budget: 'Error budget',
  canary: 'Canary',
};

async function environmentRefs(sql: SqlExecutor): Promise<Map<string, EnvironmentRef>> {
  const rows = await sql<EnvironmentRef[]>`
    select id, key, name, class from pipeline_environments order by position`;
  return new Map(rows.map((row) => [row.key, row]));
}

export async function presentPromotion(
  sql: SqlExecutor,
  access: ShippingAccess,
  row: PromotionRow,
  viewerId: string | null,
  now: Date,
): Promise<Promotion> {
  const release = await loadRelease(sql, row.release_id);
  const digest = row.release_digest ?? releaseDigest(release);
  const target = { applicationId: row.application_id, environmentId: row.environment_id };
  const [refs, [app], gates, approvals, [previous], [departure], requirements] = await Promise.all([
    environmentRefs(sql),
    sql<{ id: string; key: string; name: string; tier: number }[]>`
      select id, key, name, tier from pipeline_applications where id = ${row.application_id}`,
    sql<GateResultRow[]>`
      select gate, state, reason, evidence, recheck_at, evaluated_at from pipeline_gate_results
      where promotion_id = ${row.id} order by created_at, gate`,
    sql<ApprovalRow[]>`
      select a.id, a.promotion_id, a.user_id, u.name as user_name, a.requirement, a.decision,
        a.release_digest, a.comment, a.expires_at, a.created_at
      from pipeline_approvals a join users u on u.id = a.user_id
      where a.promotion_id = ${row.id} order by a.created_at`,
    sql<{ id: string; version: string }[]>`
      select r.id, r.version from pipeline_releases r
      where r.id = coalesce(
        (select previous_release_id from pipeline_deployments
          where promotion_id = ${row.id} order by wave, created_at limit 1),
        (select release_id from pipeline_current
          where application_id = ${row.application_id} and environment_id = ${row.environment_id}
            and release_id <> ${row.release_id}))`,
    row.departure_id
      ? sql<{ id: string; name: string; departs_at: string }[]>`
          select d.id, t.name, d.departs_at from pipeline_train_departures d
          join pipeline_trains t on t.id = d.train_id where d.id = ${row.departure_id}`
      : Promise.resolve([]),
    access.requirements(sql, { ...target, policyVersionIds: row.policy_versions ?? [] }),
  ]);
  const state = await approvalState(sql, access, {
    promotionId: row.id,
    target,
    rules: requirements.approvals,
    releaseDigest: digest,
    authors: authorsOf(release, row.requested_by),
    viewerId,
    now,
  });
  const environment = [...refs.values()].find((ref) => ref.id === row.environment_id);
  const [requester, overrider] = await Promise.all([
    row.requested_by
      ? sql<
          { id: string; name: string }[]
        >`select id, name from users where id = ${row.requested_by}`
      : Promise.resolve([]),
    row.freeze_override
      ? sql<
          { id: string; name: string }[]
        >`select id, name from users where id = ${row.freeze_override.by}`
      : Promise.resolve([]),
  ]);
  return {
    id: row.id,
    release: { id: release.id, version: release.version, commitSha: release.commit_sha, digest },
    previous: previous ?? null,
    application: {
      id: app?.id ?? row.application_id,
      key: app?.key ?? '',
      name: app?.name ?? '',
      tier: (app?.tier ?? 2) as Tier,
    },
    environment: environment ?? {
      id: row.environment_id,
      key: 'unknown',
      name: 'Unknown',
      class: 'dev' as EnvironmentClass,
    },
    mode: row.mode as PromotionMode,
    state: row.state as PromotionState,
    plan: presentPlan(readPlan(row.plan), refs),
    gates: gates.map((gate) => {
      const name = gate.gate.split(':')[0] ?? gate.gate;
      return {
        gate: (GATE_LABELS[name] || name === 'webhook' ? name : 'custom') as Gate,
        label:
          GATE_LABELS[name] ??
          (name === 'webhook' ? `Check by ${gate.gate.split(':')[1] ?? 'webhook'}` : name),
        state: gate.state as GateState,
        reason: gate.reason,
        evidence: gate.evidence,
        recheckAt: isoOrNull(gate.recheck_at),
        evaluatedAt: iso(gate.evaluated_at),
      };
    }),
    approvals: approvals.map((approval) => ({
      id: approval.id,
      user: { id: approval.user_id, name: approval.user_name, avatarUrl: null },
      requirement: approval.requirement,
      decision: approval.decision as 'approved' | 'rejected',
      releaseDigest: approval.release_digest,
      comment: approval.comment,
      expiresAt: isoOrNull(approval.expires_at),
      createdAt: iso(approval.created_at),
    })),
    requirements: state.requirements,
    departure: departure
      ? { id: departure.id, trainName: departure.name, departsAt: iso(departure.departs_at) }
      : null,
    coordinationId: row.coordination_id,
    policies: requirements.policies,
    requestedBy: requester[0] ? { ...requester[0], avatarUrl: null } : null,
    freezeOverride:
      row.freeze_override && overrider[0]
        ? {
            by: { ...overrider[0], avatarUrl: null },
            reason: row.freeze_override.reason,
            at: iso(row.freeze_override.at),
          }
        : null,
    outcomeReason: row.outcome_reason,
    expiresAt: isoOrNull(row.expires_at),
    createdAt: iso(row.created_at),
    finishedAt: isoOrNull(row.finished_at),
  };
}
