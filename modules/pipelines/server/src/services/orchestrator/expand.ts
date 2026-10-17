import type { JobKind } from '../../../../shared/runs.ts';
import type { ResolvedPipeline, ResolvedStep, Scalar } from '../../../../shared/pipeline-spec.ts';

/*
 * A run's resolved pipelines (one per application it covers) → the job rows the dispatcher
 * queues. Shards fan out here: a fixed count, or "auto" from the application's past test
 * timings, aiming at shards of about three minutes. A job that needs a sharded job needs
 * every shard. When a run covers several applications of a monorepo, keys are prefixed with
 * the application's key so they stay unique within the run.
 */

/** How long one shard should take, so a big suite fans out and a small one does not. */
export const TARGET_SHARD_SECONDS = 180;
export const MAX_AUTO_SHARDS = 8;

export interface ExpandApplication {
  id: string;
  key: string;
  teamId: string | null;
  pipeline: ResolvedPipeline;
  /** Sum of the application's known test file timings, for "auto" shards. */
  testSeconds: number;
}

export interface JobPlan {
  key: string;
  name: string;
  kind: JobKind;
  needs: string[];
  poolKey: string | null;
  applicationId: string;
  teamId: string | null;
  shardIndex: number | null;
  shardTotal: number | null;
  timeoutMinutes: number;
  matrix: Record<string, Scalar> | null;
  steps: ResolvedStep[];
}

export function autoShards(testSeconds: number): number {
  if (testSeconds <= 0) return 1;
  return Math.min(MAX_AUTO_SHARDS, Math.max(1, Math.ceil(testSeconds / TARGET_SHARD_SECONDS)));
}

export function expandJobs(applications: readonly ExpandApplication[]): JobPlan[] {
  const prefix = applications.length > 1;
  const plans: JobPlan[] = [];
  for (const application of applications) {
    const keyOf = (key: string) => (prefix ? `${application.key}.${key}` : key);
    const fanned = new Map<string, string[]>();
    const own: JobPlan[] = [];
    for (const job of application.pipeline.jobs) {
      const total = job.shards === 'auto' ? autoShards(application.testSeconds) : (job.shards ?? 1);
      const keys: string[] = [];
      for (let index = 1; index <= total; index += 1) {
        const sharded = job.shards !== null && total > 1;
        const key = keyOf(sharded ? `${job.key}-${index}` : job.key);
        keys.push(key);
        own.push({
          key,
          name: sharded ? `${job.name} ${index} of ${total}` : job.name,
          kind: job.kind,
          needs: job.needs,
          poolKey: job.pool,
          applicationId: application.id,
          teamId: application.teamId,
          shardIndex: sharded ? index : null,
          shardTotal: sharded ? total : null,
          timeoutMinutes: job.timeoutMinutes,
          matrix: job.matrix,
          steps: job.steps,
        });
      }
      fanned.set(job.key, keys);
    }
    for (const plan of own) {
      plan.needs = plan.needs.flatMap((need) => fanned.get(need) ?? [keyOf(need)]);
    }
    plans.push(...own);
  }
  return plans;
}

/**
 * Stages for the run graph: a job's stage is one past the deepest job it needs, so fan-out
 * shards share a column and a job that needs them all sits after them.
 */
export function stagesOf(jobs: ReadonlyArray<{ key: string; needs: readonly string[] }>) {
  const byKey = new Map(jobs.map((job) => [job.key, job]));
  const stage = new Map<string, number>();
  const depth = (key: string, seen: Set<string>): number => {
    const known = stage.get(key);
    if (known !== undefined) return known;
    const job = byKey.get(key);
    if (!job || seen.has(key)) return 0;
    seen.add(key);
    const value = job.needs.reduce(
      (deepest, need) => (byKey.has(need) ? Math.max(deepest, depth(need, seen) + 1) : deepest),
      0,
    );
    stage.set(key, value);
    return value;
  };
  for (const job of jobs) depth(job.key, new Set());
  return stage;
}
