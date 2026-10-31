import { ProviderError } from '@bemmoly/shared';
import type { RuntimeMoveRow } from '../../models/front-doors.ts';
import type { MetricName } from '../providers/contract.ts';
import {
  FAILURES_TO_ROLL_BACK,
  judgeMetric,
  nextFailingStreak,
  overallVerdict,
  type MetricJudgement,
  type Verdict,
} from '../rollout/judge.ts';
import { describeJudgements } from '../shipping/deployments/analyse.ts';
import { loadRelease } from '../shipping/load.ts';
import { artifactOf } from '../shipping/targets.ts';
import {
  createMoveSteps,
  LIVE_STATES,
  runtimeName,
  type MoveEngineDeps,
  type Sides,
} from './moves.ts';

/*
 * One runtime move from start to end. Deploy the release on the new runtime and give it that
 * runtime's whole share; wait until it is healthy and the front door can reach it, at 0%;
 * then shift in steps, each held and judged by the canary judge against the old runtime's
 * revision; at 100% hold once more, judged on its own; then remove the old runtime. Two
 * failing samples in a row roll back by themselves, a marginal one pauses and asks a person.
 */

const MINUTE = 60_000;
const WINDOW_CAP_MS = 10 * MINUTE;
/** Samples a step waits for health or metrics before it asks a person. */
const PATIENCE_SAMPLES = 30;
const METRICS: readonly MetricName[] = ['error_rate', 'latency_p95'];

interface Judged {
  verdict: Verdict;
  judgements: MetricJudgement[];
  unavailable: boolean;
}

export function createMoveEngine(deps: MoveEngineDeps) {
  const { sql } = deps;
  const steps = createMoveSteps(deps);
  const { write, split, pause, rollBack, finish } = steps;
  const sampleAt = (row: RuntimeMoveRow, now: Date) =>
    new Date(now.getTime() + row.sample_seconds * 1000);

  async function deploy(row: RuntimeMoveRow, s: Sides, now: Date) {
    const targets = s.to.provider.targets;
    if (!targets || !row.release_id) {
      throw new ProviderError(`Nothing is released here to move to ${runtimeName(row.to_runtime)}`);
    }
    const release = await loadRelease(sql, row.release_id);
    const variables = await deps.variables?.(row.application_id, row.environment_id);
    const { revision } = await targets.deploy(s.to.target, artifactOf(release), variables);
    // The new runtime's own split sends all it is given to the new revision.
    await targets.shift(s.to.target, { revision, percent: 100, stable: null });
    await write(
      row,
      {
        state: 'warming',
        message: `${revision} is up on ${runtimeName(row.to_runtime)}, taking no traffic yet`,
        toRevision: revision,
        stepStartedAt: now,
        waited: 0,
        nextActionAt: now,
      },
      now,
    );
  }

  async function wait(row: RuntimeMoveRow, message: string, now: Date) {
    const waited = row.waited_samples + 1;
    if (waited >= PATIENCE_SAMPLES) {
      return pause(row, `${message}. Continue to keep waiting, or roll back`, now);
    }
    await write(row, { state: row.state, message, waited, nextActionAt: sampleAt(row, now) }, now);
  }

  async function stepTo(row: RuntimeMoveRow, s: Sides, index: number, now: Date) {
    const percent = Math.min(100, row.steps[index] ?? 100);
    await split(row, s, percent);
    const holding = percent >= 100;
    const to = runtimeName(row.to_runtime);
    await write(
      row,
      {
        state: holding ? 'holding' : 'shifting',
        message: holding
          ? `Every request on ${to}; holding ${row.hold_minutes} minutes before ${runtimeName(row.from_runtime)} is removed`
          : `${percent}% of requests on ${to}`,
        percent,
        stepIndex: holding ? row.steps.length - 1 : index,
        stepStartedAt: now,
        failing: 0,
        waited: 0,
        nextActionAt: sampleAt(row, now),
      },
      now,
    );
  }

  async function warm(row: RuntimeMoveRow, s: Sides, now: Date) {
    const revision = row.to_revision ?? '';
    const to = runtimeName(row.to_runtime);
    const health = await s.to.provider.targets?.health(s.to.target, revision);
    if (health === 'failing') {
      return rollBack(row, s, `Rolled back: ${revision} failed its health check on ${to}`, now);
    }
    if (health !== 'healthy')
      return wait(row, `Waiting for ${revision} to be healthy on ${to}`, now);
    try {
      await split(row, s, 0);
    } catch (error) {
      if (error instanceof ProviderError) return wait(row, error.message, now);
      throw error;
    }
    await stepTo(row, s, 0, now);
  }

  /** The new revision against the old over the step so far; alone while holding at 100%. */
  async function judge(row: RuntimeMoveRow, s: Sides, now: Date): Promise<Judged> {
    const metrics = s.to.provider.metrics;
    if (!metrics || !row.to_revision)
      return { verdict: 'pending', judgements: [], unavailable: true };
    const started = new Date(row.step_started_at ?? now).getTime();
    const from = Math.max(started, now.getTime() - WINDOW_CAP_MS);
    const window = { from: new Date(Math.min(from, now.getTime() - 1000)), to: now };
    const compare = row.state === 'shifting' && row.from_revision;
    const judgements: MetricJudgement[] = [];
    for (const metric of METRICS) {
      const canary = await metrics.revision(s.to.target, row.to_revision, metric, window);
      const stable =
        compare && row.from_revision && s.from.provider.metrics
          ? await s.from.provider.metrics.revision(s.from.target, row.from_revision, metric, window)
          : null;
      judgements.push(judgeMetric(metric, canary, stable));
    }
    return { verdict: overallVerdict(judgements), judgements, unavailable: false };
  }

  async function sample(row: RuntimeMoveRow, s: Sides, now: Date) {
    const holding = row.state === 'holding';
    const result = await judge(row, s, now).catch((): Judged => ({
      verdict: 'pending',
      judgements: [],
      unavailable: false,
    }));
    const streak = nextFailingStreak(row.failing_samples, result.verdict);
    const why = describeJudgements(result.judgements);
    const where = holding
      ? `while holding on ${runtimeName(row.to_runtime)}`
      : `at ${row.traffic_percent}%`;
    if (streak >= FAILURES_TO_ROLL_BACK)
      return rollBack(row, s, `Rolled back ${where}: ${why}`, now);
    if (result.verdict === 'marginal') {
      return pause(row, `Marginal ${where}: ${why}. Continue or roll back`, now);
    }
    const waited = row.waited_samples + (result.verdict === 'pending' ? 1 : 0);
    const elapsed = now.getTime() - new Date(row.step_started_at ?? now).getTime();
    if (elapsed >= row.hold_minutes * MINUTE && streak === 0) {
      if (holding) return finish(row, s, now);
      if (result.verdict === 'pass') return stepTo(row, s, row.step_index + 1, now);
      if (result.unavailable || waited >= PATIENCE_SAMPLES) {
        return pause(row, `No metrics to judge ${where}. Continue or roll back`, now);
      }
    }
    await write(
      row,
      {
        state: row.state,
        message: row.message,
        failing: streak,
        waited,
        nextActionAt: sampleAt(row, now),
      },
      now,
    );
  }

  /** Moves one move on if it is due and nobody holds it. */
  async function advance(id: string): Promise<void> {
    const now = deps.now();
    const row = await steps.claim(id, LIVE_STATES, now, true);
    if (!row) return;
    let s: Sides;
    try {
      s = await steps.sides(row);
    } catch (error) {
      const message = (error as Error).message;
      await write(row, { state: 'failed', message, nextActionAt: null, finished: true }, now);
      return;
    }
    try {
      if (row.state === 'deploying') await deploy(row, s, now);
      else if (row.state === 'warming') await warm(row, s, now);
      else await sample(row, s, now);
    } catch (error) {
      const message = `${s.to.provider.name} failed: ${(error as Error).message}`;
      if (row.state === 'deploying') {
        await write(row, { state: 'failed', message, nextActionAt: null, finished: true }, now);
        return;
      }
      try {
        await rollBack(row, s, `Rolled back because ${message}`, now);
      } catch (again) {
        const failed = `${message}. Rolling back failed too: ${(again as Error).message}. Check the front door's weights in the cloud console`;
        await write(
          row,
          { state: 'failed', message: failed, nextActionAt: null, finished: true },
          now,
        );
      }
    }
  }

  return {
    steps,
    advance,
    /** Every move due now; a lost wake-up costs at most the sweep's minute. */
    async sweep(limit = 100): Promise<number> {
      const due = await sql<{ id: string }[]>`
        select id from pipeline_runtime_moves
        where state = any(${[...LIVE_STATES]}::text[])
          and next_action_at <= ${deps.now().toISOString()}::timestamptz
        order by next_action_at limit ${limit}`;
      for (const { id } of due) await advance(id);
      return due.length;
    },
  };
}

export type MoveEngine = ReturnType<typeof createMoveEngine>;
