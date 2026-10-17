import type { MetricName } from '../providers/contract.ts';

/*
 * Canary judgement (architecture §13): the canary revision against stable over the same
 * window, per metric. The answer is pass, marginal or fail, like Kayenta: marginal pauses the
 * rollout and asks a person, two failing samples in a row roll it back. Too few requests is
 * "pending", never "pass": a canary nobody has called has proved nothing.
 */

export type Verdict = 'pass' | 'marginal' | 'fail' | 'pending';

export interface MetricSample {
  value: number | null;
  requests: number;
}

export interface MetricJudgement {
  metric: MetricName;
  verdict: Verdict;
  reason: string;
}

export const JUDGE_DEFAULTS = {
  minRequests: 20,
  errorRate: {
    failDelta: 0.01,
    marginalDelta: 0.003,
    failRatio: 2,
    marginalRatio: 1.5,
    /** With no stable to compare against, absolute ceilings decide. */
    failCeiling: 0.05,
    marginalCeiling: 0.02,
  },
  latency: { failRatio: 1.5, marginalRatio: 1.2, failDeltaMs: 50, marginalDeltaMs: 20 },
} as const;

const pct = (value: number) => `${(value * 100).toFixed(2)}%`;
const ms = (value: number) => `${Math.round(value)} ms`;

function judgeErrorRate(canary: number, stable: number | null): Omit<MetricJudgement, 'metric'> {
  const t = JUDGE_DEFAULTS.errorRate;
  if (stable === null) {
    if (canary > t.failCeiling) return { verdict: 'fail', reason: `${pct(canary)} errors` };
    if (canary > t.marginalCeiling) return { verdict: 'marginal', reason: `${pct(canary)} errors` };
    return { verdict: 'pass', reason: `${pct(canary)} errors` };
  }
  const delta = canary - stable;
  const against = `${pct(canary)} errors against ${pct(stable)} on stable`;
  if (delta > t.failDelta && canary > stable * t.failRatio)
    return { verdict: 'fail', reason: against };
  if (delta > t.marginalDelta && canary > stable * t.marginalRatio) {
    return { verdict: 'marginal', reason: against };
  }
  return { verdict: 'pass', reason: against };
}

function judgeLatency(canary: number, stable: number | null): Omit<MetricJudgement, 'metric'> {
  const t = JUDGE_DEFAULTS.latency;
  if (stable === null) return { verdict: 'pass', reason: `p95 ${ms(canary)}` };
  const delta = canary - stable;
  const against = `p95 ${ms(canary)} against ${ms(stable)} on stable`;
  if (delta > t.failDeltaMs && canary > stable * t.failRatio)
    return { verdict: 'fail', reason: against };
  if (delta > t.marginalDeltaMs && canary > stable * t.marginalRatio) {
    return { verdict: 'marginal', reason: against };
  }
  return { verdict: 'pass', reason: against };
}

export function judgeMetric(
  metric: MetricName,
  canary: MetricSample | null,
  stable: MetricSample | null,
): MetricJudgement {
  if (!canary || canary.value === null || canary.requests < JUDGE_DEFAULTS.minRequests) {
    const seen = canary?.requests ?? 0;
    return {
      metric,
      verdict: 'pending',
      reason: `${seen} requests so far, needs ${JUDGE_DEFAULTS.minRequests}`,
    };
  }
  const baseline = stable && stable.value !== null && stable.requests > 0 ? stable.value : null;
  const judged =
    metric === 'error_rate'
      ? judgeErrorRate(canary.value, baseline)
      : judgeLatency(canary.value, baseline);
  return { metric, ...judged };
}

const RANK: Readonly<Record<Verdict, number>> = { pending: 0, pass: 1, marginal: 2, fail: 3 };

/** The worst verdict across metrics; pending only when nothing could be judged. */
export function overallVerdict(judgements: readonly MetricJudgement[]): Verdict {
  const judged = judgements.filter((j) => j.verdict !== 'pending');
  if (judged.length === 0) return 'pending';
  return judged.reduce<Verdict>(
    (worst, j) => (RANK[j.verdict] > RANK[worst] ? j.verdict : worst),
    'pass',
  );
}

/** What a run of samples means: two failures in a row roll back (§13). */
export function nextFailingStreak(streak: number, verdict: Verdict): number {
  if (verdict === 'fail') return streak + 1;
  if (verdict === 'pass') return 0;
  return streak;
}

export const FAILURES_TO_ROLL_BACK = 2;
