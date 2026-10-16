import type { DeploymentRow } from '../../../models/shipping.ts';
import type { CloudProvider, DeployTarget } from '../../providers/contract.ts';
import { FAILURES_TO_ROLL_BACK, nextFailingStreak } from '../../rollout/judge.ts';
import { deploymentPlanSchema } from '../../rollout/plan.ts';
import { LEASE_MS, type ShippingEngineDeps } from '../engine-deps.ts';
import { loadRelease } from '../load.ts';
import { artifactOf, resolveTarget } from '../targets.ts';
import { analyse, describeJudgements, measureBaseline, type AnalysisResult } from './analyse.ts';
import { createMoves, type Step } from './moves.ts';

/*
 * The rollout of one deployment (architecture §12, §13): deploy a revision with no traffic,
 * walk the canary steps (shift, wait, analyse), watch at 100% against the old baseline,
 * then succeed. Two failing samples in a row roll back by themselves; a marginal one pauses
 * and asks a person. Each step is claimed under a lease, provider calls happen outside any
 * transaction, and every state change goes through recordDeploymentEvent.
 */

const MINUTE = 60_000;

export function createRolloutEngine(deps: ShippingEngineDeps) {
  const { sql } = deps;
  const { write, sampleAt, rollBack, pause, succeed, goTo } = createMoves(deps);

  async function claim(id: string, now: Date): Promise<DeploymentRow | null> {
    return sql.begin(async (tx) => {
      const [row] = await tx<DeploymentRow[]>`
        select * from pipeline_deployments
        where id = ${id} and state in ('pending', 'deploying', 'canary')
          and (next_action_at is null or next_action_at <= ${now.toISOString()}::timestamptz)
        for update skip locked`;
      if (!row) return null;
      await tx`update pipeline_deployments
        set next_action_at = ${new Date(now.getTime() + LEASE_MS).toISOString()}::timestamptz
        where id = ${id}`;
      return row;
    });
  }

  async function start(step: Step) {
    const { row, provider, target, now } = step;
    const parts = provider.targets;
    if (!parts?.kinds.includes(target.application.runtime)) {
      await write(
        row,
        {
          state: 'failed',
          message: `${provider.name} cannot deploy ${target.application.runtime} applications yet`,
          phase: 'done',
          nextActionAt: null,
          reason: 'Unsupported deploy target',
        },
        now,
      );
      return;
    }
    const release = await loadRelease(sql, row.release_id);
    // The provider holds the weights (§19): a previous revision it does not route to (made
    // elsewhere, or gone) cannot be a canary's stable or a roll back's destination.
    const live = await parts.describe(target);
    const stable = live.traffic.some((t) => t.revision === row.previous_revision && t.percent > 0)
      ? row.previous_revision
      : null;
    if (stable !== row.previous_revision) {
      await sql`update pipeline_deployments set previous_revision = null where id = ${row.id}`;
    }
    const baseline = await measureBaseline(provider, target, stable, now);
    const { revision } = await parts.deploy(target, artifactOf(release));
    const plan = { ...step.plan, ...(baseline ? { baseline } : {}) };
    await write(
      row,
      {
        state: 'deploying',
        message: `Revision ${revision} is up, taking no traffic yet`,
        revision,
        plan: { ...plan },
        phase: 'deploy',
        nextActionAt: null,
      },
      now,
    );
    // With nothing running before it there is no stable to compare a canary against, so a
    // first deploy goes straight to 100% and is judged by the watch alone.
    const first = stable ? 0 : plan.steps.length;
    await goTo({ ...step, row: { ...row, revision, previous_revision: stable }, plan }, first);
  }

  async function judge(step: Step, phase: 'step' | 'watch'): Promise<AnalysisResult> {
    try {
      return await analyse(sql, {
        deployment: step.row,
        plan: step.plan,
        provider: step.provider,
        target: step.target,
        phase,
        now: step.now,
      });
    } catch (error) {
      // Metrics that cannot be read this time are a pending sample, not a verdict.
      return {
        verdict: 'pending',
        unavailable: false,
        judgements: [
          { metric: 'error_rate', verdict: 'pending', reason: (error as Error).message },
        ],
      };
    }
  }

  async function sample(step: Step, phase: 'step' | 'watch') {
    const { row, plan, now } = step;
    const result = await judge(step, phase);
    const streak = nextFailingStreak(row.failing_samples, result.verdict);
    const why = describeJudgements(result.judgements);
    const where = phase === 'watch' ? 'during the watch' : `at ${row.traffic_percent}%`;
    if (streak >= FAILURES_TO_ROLL_BACK) {
      if (plan.autoRollback) return rollBack(step, `Rolled back ${where}: ${why}`, true, streak);
      return pause(step, `Two failing samples ${where}: ${why}. Roll back or continue.`);
    }
    if (result.verdict === 'marginal') {
      return pause(step, `Marginal ${where}: ${why}. Continue or roll back.`);
    }
    const elapsed = now.getTime() - new Date(row.step_started_at ?? now).getTime();
    const hold = (phase === 'watch' ? plan.watchMinutes : plan.holdMinutes) * MINUTE;
    if (elapsed >= hold && streak === 0) {
      if (phase === 'watch') {
        return succeed(
          step,
          result.verdict === 'pass'
            ? `Healthy through the watch: ${why}`
            : 'Watch ended without metrics to judge',
        );
      }
      if (result.unavailable || result.verdict === 'pending') {
        return pause(step, `No metrics to judge ${where}. Continue or roll back.`);
      }
      return goTo(step, row.step_index + 1);
    }
    const next = sampleAt(step);
    await sql`update pipeline_deployments set failing_samples = ${streak},
        next_action_at = ${next.toISOString()}::timestamptz where id = ${row.id}`;
    await deps.wake('deployment', row.id, next);
  }

  return {
    /**
     * Rolls a live deployment back now, for a person or a stopped promotion. One that has no
     * revision yet is cancelled instead: nothing reached the provider.
     */
    async stop(row: DeploymentRow, reason: string, automatic: boolean): Promise<void> {
      const now = deps.now();
      if (!row.revision) {
        await write(
          row,
          { state: 'cancelled', message: reason, phase: 'done', nextActionAt: null, reason },
          now,
        );
        return;
      }
      const resolved = await resolveTarget(
        sql,
        deps.providers,
        row.application_id,
        row.environment_id,
      );
      const plan = deploymentPlanSchema.parse(row.plan ?? {});
      await rollBack({ row, plan, ...resolved, now }, reason, automatic);
    },

    /** Picks a paused canary up again where it stopped, on a person's word. */
    async resume(row: DeploymentRow, reason: string): Promise<void> {
      const now = deps.now();
      const watching = row.traffic_percent >= 100;
      await write(
        row,
        {
          state: 'canary',
          message: reason,
          phase: watching ? 'watch' : 'step',
          pauseReason: null,
          failingSamples: 0,
          stepStartedAt: now,
          nextActionAt: now,
        },
        now,
      );
    },

    /** Moves one deployment forward if it is due; a no-op when another worker holds it. */
    async advance(id: string): Promise<void> {
      const now = deps.now();
      const row = await claim(id, now);
      if (!row) return;
      const plan = deploymentPlanSchema.parse(row.plan ?? {});
      let resolved: { provider: CloudProvider; target: DeployTarget };
      try {
        resolved = await resolveTarget(sql, deps.providers, row.application_id, row.environment_id);
      } catch (error) {
        await write(
          row,
          {
            state: 'failed',
            message: (error as Error).message,
            phase: 'done',
            nextActionAt: null,
            reason: (error as Error).message,
          },
          now,
        );
        return;
      }
      const step: Step = { row, plan, ...resolved, now };
      try {
        if (row.phase === 'deploy') await start(step);
        else if (row.phase === 'step') await sample(step, 'step');
        else if (row.phase === 'watch') await sample(step, 'watch');
      } catch (error) {
        const message = `${resolved.provider.name} failed: ${(error as Error).message}`;
        if (row.phase === 'deploy') {
          await write(
            row,
            { state: 'failed', message, phase: 'done', nextActionAt: null, reason: message },
            now,
          );
        } else {
          await rollBack(step, `Rolled back because ${message}`, true);
        }
      }
    },
  };
}

export type RolloutEngine = ReturnType<typeof createRolloutEngine>;
