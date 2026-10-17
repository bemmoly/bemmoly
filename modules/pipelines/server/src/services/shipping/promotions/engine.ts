import type { SqlExecutor } from '@bemmoly/core';
import type { PromotionRow } from '../../../models/shipping.ts';
import { readPlan } from '../../rollout/plan.ts';
import { approvalState } from '../approvals/state.ts';
import { LEASE_MS, type ShippingEngineDeps } from '../engine-deps.ts';
import { evaluateGates, gateCalls, summarise, type EvaluatedGate } from '../gates/index.ts';
import {
  authorsOf,
  loadApplication,
  loadEnvironment,
  loadRelease,
  releaseDigest,
} from '../load.ts';
import { resolveTarget } from '../targets.ts';
import { finishPromotion, publishPromotion } from './finish.ts';
import { advanceRollout } from './rollout.ts';

/*
 * The promotion state machine (architecture §11): requested → gating → awaiting_approval →
 * scheduled → rolling_out → succeeded | rolled_back | cancelled (or failed when a gate
 * fails). Facts are gated first, then people approve; a train or a coordinated release
 * holds a scheduled promotion until its turn. Gates are re-read on their recheck time and
 * whenever something relevant happens (an approval, a deployment finishing).
 */

const MINUTE = 60_000;
const OPEN = ['requested', 'gating', 'awaiting_approval', 'scheduled', 'rolling_out'];

async function storeGates(tx: SqlExecutor, promotionId: string, gates: readonly EvaluatedGate[]) {
  for (const gate of gates) {
    await tx`
      insert into pipeline_gate_results
        (promotion_id, gate, state, reason, evidence, recheck_at, evaluated_at)
      values (${promotionId}, ${gate.key}, ${gate.state}, ${gate.reason},
        ${JSON.stringify(gate.evidence)}::jsonb, ${gate.recheckAt}::timestamptz,
        ${gate.evaluatedAt}::timestamptz)
      on conflict (promotion_id, gate) do update set state = excluded.state,
        reason = excluded.reason, evidence = excluded.evidence, recheck_at = excluded.recheck_at,
        evaluated_at = excluded.evaluated_at, updated_at = excluded.evaluated_at`;
  }
}

export function createPromotionEngine(deps: ShippingEngineDeps) {
  const { sql } = deps;

  async function claim(id: string, now: Date, force: boolean): Promise<PromotionRow | null> {
    return sql.begin(async (tx) => {
      const [row] = await tx<PromotionRow[]>`
        select * from pipeline_promotions
        where id = ${id} and state = any(${OPEN}::text[])
          and (${force}::boolean or next_check_at is null
            or next_check_at <= ${now.toISOString()}::timestamptz)
        for update skip locked`;
      if (!row) return null;
      await tx`update pipeline_promotions
        set next_check_at = ${new Date(now.getTime() + LEASE_MS).toISOString()}::timestamptz
        where id = ${id}`;
      return row;
    });
  }

  async function setState(
    row: PromotionRow,
    state: string,
    nextCheck: Date | null,
    extra: { approved?: boolean } = {},
  ) {
    const now = deps.now();
    await sql.begin(async (tx) => {
      await tx`
        update pipeline_promotions set state = ${state},
          next_check_at = ${nextCheck ? nextCheck.toISOString() : null}::timestamptz,
          approved_at = case when ${extra.approved === true}::boolean then coalesce(approved_at, ${now.toISOString()}::timestamptz) else approved_at end,
          updated_at = ${now.toISOString()}::timestamptz
        where id = ${row.id}`;
      if (state !== row.state) await publishPromotion(tx, row.id, state);
    });
    if (nextCheck) await deps.wake('promotion', row.id, nextCheck);
  }

  async function finish(
    row: PromotionRow,
    outcome: 'succeeded' | 'rolled_back' | 'cancelled' | 'failed',
    reason: string,
  ) {
    await sql.begin((tx) => finishPromotion(tx, row.id, outcome, reason, deps.now()));
  }

  /** Gates and approvals for a promotion that has not started rolling out. */
  async function decide(row: PromotionRow, now: Date) {
    const [release, application, environment] = await Promise.all([
      loadRelease(sql, row.release_id),
      loadApplication(sql, { id: row.application_id }),
      loadEnvironment(sql, row.environment_id),
    ]);
    const target = { applicationId: row.application_id, environmentId: row.environment_id };
    const requirements = await deps.access.requirements(sql, {
      ...target,
      policyVersionIds: row.policy_versions ?? [],
    });
    const digest = row.release_digest ?? releaseDigest(release);
    let metrics = null;
    try {
      const resolved = await resolveTarget(
        sql,
        deps.providers,
        row.application_id,
        row.environment_id,
      );
      metrics = resolved.provider.metrics
        ? { part: resolved.provider.metrics, target: resolved.target }
        : null;
    } catch {
      // No connection yet: gates that need metrics say they are waiting for them.
    }
    const override = row.freeze_override;
    const [overrider] = override
      ? await sql<{ name: string }[]>`select name from users where id = ${override.by}`
      : [];
    const facts = {
      now,
      promotion: {
        id: row.id,
        requestedBy: row.requested_by,
        releaseDigest: digest,
        freezeOverride: override
          ? { ...override, byName: overrider?.name ?? 'a Release manager' }
          : null,
      },
      release,
      application,
      environment,
      requirements,
    };
    const gates = await evaluateGates(gateCalls(requirements.gates), facts, {
      sql,
      metrics,
      webhook: deps.webhook,
    });
    const approvals = await approvalState(sql, deps.access, {
      promotionId: row.id,
      target,
      rules: requirements.approvals,
      releaseDigest: digest,
      authors: authorsOf(release, row.requested_by),
      viewerId: null,
      now,
    });
    const needed = approvals.requirements.reduce((sum, r) => sum + r.needed, 0);
    const have = approvals.requirements.reduce((sum, r) => sum + r.have, 0);
    gates.push({
      key: 'approvals',
      gate: 'approvals',
      label: 'Approvals',
      state: approvals.rejection ? 'fail' : approvals.satisfied ? 'pass' : 'pending',
      reason: approvals.rejection
        ? `Rejected by ${approvals.rejection.name}`
        : needed === 0
          ? 'No approval needed'
          : `${have} of ${needed} approvals`,
      evidence: { have, needed },
      recheckAt: null,
      evaluatedAt: now.toISOString(),
    });
    await sql.begin(async (tx) => {
      await storeGates(tx, row.id, gates);
      if (!row.release_digest) {
        await tx`update pipeline_promotions set release_digest = ${digest} where id = ${row.id}`;
      }
    });
    return { gates, approvals, facts: summarise(gates.filter((g) => g.key !== 'approvals')) };
  }

  async function advance(id: string, options: { force?: boolean } = {}): Promise<void> {
    const now = deps.now();
    const row = await claim(id, now, options.force === true);
    if (!row) return;
    if (row.state === 'rolling_out') {
      const outcome = await advanceRollout(deps, row, readPlan(row.plan), now);
      if (outcome.finished) await finish(row, outcome.finished, outcome.reason);
      else await setState(row, 'rolling_out', outcome.nextCheck);
      return;
    }
    if (
      row.expires_at &&
      new Date(row.expires_at).getTime() <= now.getTime() &&
      row.state !== 'scheduled'
    ) {
      await finish(row, 'cancelled', 'Expired before it was approved');
      return;
    }
    const { gates, approvals, facts } = await decide(row, now);
    if (approvals.rejection) {
      const comment = approvals.rejection.comment ? `: ${approvals.rejection.comment}` : '';
      await finish(row, 'cancelled', `Rejected by ${approvals.rejection.name}${comment}`);
      return;
    }
    if (facts.state === 'fail') {
      const failed = gates.filter((g) => g.state === 'fail').map((g) => `${g.label}: ${g.reason}`);
      await finish(row, 'failed', failed.join('; '));
      return;
    }
    const recheck = facts.recheckAt ?? new Date(now.getTime() + 5 * MINUTE);
    if (facts.state === 'pending') return setState(row, 'gating', recheck);
    if (!approvals.satisfied) {
      // Nothing changes until someone decides, except that the request may expire.
      return setState(row, 'awaiting_approval', row.expires_at ? new Date(row.expires_at) : null);
    }
    const turn = await waitingFor(row);
    if (turn)
      return setState(row, 'scheduled', new Date(now.getTime() + MINUTE), { approved: true });
    await setState(row, 'rolling_out', null, { approved: true });
    await sql`update pipeline_promotions set started_at = ${now.toISOString()}::timestamptz
      where id = ${row.id} and started_at is null`;
    const outcome = await advanceRollout(
      deps,
      { ...row, state: 'rolling_out' },
      readPlan(row.plan),
      now,
    );
    if (outcome.finished) await finish(row, outcome.finished, outcome.reason);
    else await setState({ ...row, state: 'rolling_out' }, 'rolling_out', outcome.nextCheck);
  }

  /** A train that has not departed, or an earlier step of a coordinated release. */
  async function waitingFor(row: PromotionRow): Promise<string | null> {
    if (row.departure_id) {
      const [departure] = await sql<{ state: string }[]>`
        select state from pipeline_train_departures where id = ${row.departure_id}`;
      if (departure && departure.state !== 'rolling_out') return 'train';
    }
    if (row.coordination_id !== null && row.coordination_order !== null) {
      const [earlier] = await sql<{ n: number }[]>`
        select count(*)::int as n from pipeline_promotions
        where coordination_id = ${row.coordination_id} and coordination_order < ${row.coordination_order}
          and state <> 'succeeded'`;
      if ((earlier?.n ?? 0) > 0) return 'coordinated';
    }
    return null;
  }

  return { advance, decide, finish };
}

export type PromotionEngine = ReturnType<typeof createPromotionEngine>;
