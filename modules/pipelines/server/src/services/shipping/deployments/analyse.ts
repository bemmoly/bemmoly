import type { SqlExecutor } from '@bemmoly/core';
import type { DeploymentRow } from '../../../models/shipping.ts';
import type { CloudProvider, DeployTarget, MetricName } from '../../providers/contract.ts';
import {
  judgeMetric,
  overallVerdict,
  type MetricJudgement,
  type MetricSample,
  type Verdict,
} from '../../rollout/judge.ts';
import type { DeploymentPlan } from '../../rollout/plan.ts';

/*
 * One analysis sample (architecture §13): the canary revision and stable over the same
 * window, every check the plan names. During the watch there is no stable revision taking
 * traffic, so the new revision is compared with the baseline measured before the deploy.
 * Samples are stored as evidence; a roll back's record points at them.
 */

const WINDOW_CAP_MS = 10 * 60_000;
const METRICS: readonly MetricName[] = ['error_rate', 'latency_p95'];

export interface AnalysisResult {
  verdict: Verdict;
  judgements: MetricJudgement[];
  /** True when the provider has no metrics source at all for this target. */
  unavailable: boolean;
}

export async function measureBaseline(
  provider: CloudProvider,
  target: DeployTarget,
  revision: string | null,
  now: Date,
): Promise<DeploymentPlan['baseline']> {
  if (!revision || !provider.metrics) return undefined;
  const window = { from: new Date(now.getTime() - WINDOW_CAP_MS), to: now };
  const read = async (metric: MetricName) => {
    const result = await provider.metrics?.revision(target, revision, metric, window);
    return result && result.requests > 0 ? result.value : null;
  };
  return { error_rate: await read('error_rate'), latency_p95: await read('latency_p95') };
}

export async function analyse(
  sql: SqlExecutor,
  input: {
    deployment: DeploymentRow;
    plan: DeploymentPlan;
    provider: CloudProvider;
    target: DeployTarget;
    phase: 'step' | 'watch';
    now: Date;
  },
): Promise<AnalysisResult> {
  const { deployment, plan, provider, target, phase, now } = input;
  const revision = deployment.revision;
  if (!provider.metrics || !revision)
    return { verdict: 'pending', judgements: [], unavailable: true };
  const started = new Date(deployment.step_started_at ?? now).getTime();
  const window = { from: new Date(Math.max(started, now.getTime() - WINDOW_CAP_MS)), to: now };
  if (window.to.getTime() - window.from.getTime() < 1000)
    window.from = new Date(now.getTime() - 60_000);
  const checks = METRICS.filter((metric) => plan.checks.includes(metric));
  const judgements: MetricJudgement[] = [];
  let unavailable = true;
  for (const metric of checks) {
    const canary = await provider.metrics.revision(target, revision, metric, window);
    let stable: MetricSample | null = null;
    if (phase === 'step' && deployment.previous_revision) {
      stable = await provider.metrics.revision(
        target,
        deployment.previous_revision,
        metric,
        window,
      );
    } else if (phase === 'watch') {
      const value = plan.baseline?.[metric] ?? null;
      stable = value === null ? null : { value, requests: 1 };
    }
    if (canary) unavailable = false;
    const judgement = judgeMetric(metric, canary, stable);
    judgements.push(judgement);
    await sql`
      insert into pipeline_canary_samples
        (deployment_id, step_index, phase, traffic_percent, metric, canary_value, stable_value,
         canary_requests, verdict, sampled_at)
      values (${deployment.id}, ${deployment.step_index}, ${phase}, ${deployment.traffic_percent},
        ${metric}, ${canary?.value ?? null}, ${stable?.value ?? null}, ${canary?.requests ?? 0},
        ${judgement.verdict}, ${now.toISOString()}::timestamptz)`;
  }
  return { verdict: overallVerdict(judgements), judgements, unavailable };
}

/** "error rate 4.10% errors against 0.20% on stable": the reason a person reads. */
export function describeJudgements(judgements: readonly MetricJudgement[]): string {
  const notable = judgements.filter((j) => j.verdict === 'fail' || j.verdict === 'marginal');
  const shown = notable.length > 0 ? notable : judgements;
  return shown
    .map((j) => `${j.metric === 'error_rate' ? 'Error rate' : 'Latency'} ${j.reason}`)
    .join('; ');
}
