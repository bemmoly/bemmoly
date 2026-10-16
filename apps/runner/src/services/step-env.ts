import type { ClaimedJob, ResolvedStep } from '@bemmoly/module-pipelines/shared';

function axisName(axis: string): string {
  return axis.toUpperCase().replace(/[^A-Z0-9]/g, '_');
}

/**
 * A step's environment: the job's env, the step's env, the secrets the step names, then the
 * values every step can count on. Those come last so a pipeline cannot spoof them.
 */
export function stepEnv(
  job: ClaimedJob,
  step: ResolvedStep,
  secrets: Readonly<Record<string, string>>,
  apiUrl: string,
): Record<string, string> {
  const env: Record<string, string> = { ...job.env, ...step.env };
  for (const name of step.secrets) {
    const value = secrets[name];
    if (value !== undefined) env[name] = value;
  }
  env['CI'] = 'true';
  env['BEMMOLY_RUN_ID'] = job.runId;
  env['BEMMOLY_JOB_ID'] = job.jobId;
  env['BEMMOLY_RUN_NUMBER'] = String(job.runNumber);
  env['BEMMOLY_COMMIT_SHA'] = job.repository.commitSha;
  env['BEMMOLY_REF'] = job.repository.ref;
  if (job.shard) {
    env['BEMMOLY_SHARD_INDEX'] = String(job.shard.index);
    env['BEMMOLY_SHARD_TOTAL'] = String(job.shard.total);
  }
  for (const [axis, value] of Object.entries(job.matrix ?? {})) {
    env[`BEMMOLY_MATRIX_${axisName(axis)}`] = String(value);
  }
  // `bemmoly-runner split` inside the step calls back with these.
  env['BEMMOLY_API_URL'] = apiUrl;
  env['BEMMOLY_JOB_TOKEN'] = job.jobToken;
  return env;
}
