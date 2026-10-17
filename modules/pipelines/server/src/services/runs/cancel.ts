import type { SqlExecutor } from '@bemmoly/core';

/*
 * Cancelling a run's jobs: waiting jobs stop at once; claimed and running ones are marked
 * cancelled and their runner hears it at its next heartbeat and stops the step. A deploy
 * already shifting traffic is never stopped mid-step when a newer run supersedes this one
 * (architecture §5.2); a person cancelling on purpose can still stop it.
 */

export async function cancelJobsOf(
  tx: SqlExecutor,
  runId: string,
  options: { keepRunningDeploys?: boolean; reason?: string } = {},
): Promise<number> {
  const rows = await tx`
    update pipeline_jobs set state = 'cancelled', finished_at = now(), updated_at = now(),
      failure_summary = coalesce(${options.reason ?? null}, failure_summary)
    where run_id = ${runId}
      and state in ('pending', 'ready', 'claimed', 'running')
      and not (${options.keepRunningDeploys ?? false} and kind = 'deploy' and state = 'running')
    returning id`;
  await tx`
    update pipeline_steps s set state = 'cancelled', finished_at = coalesce(s.finished_at, now()),
      updated_at = now()
    from pipeline_jobs j
    where s.job_id = j.id and j.run_id = ${runId} and j.state = 'cancelled'
      and s.state in ('pending', 'running')`;
  return rows.length;
}
