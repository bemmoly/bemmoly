import type { SqlExecutor } from '@bemmoly/core';
import { NotFoundError, ValidationError } from '@bemmoly/shared';
import { advanceRun, type RunOutcome } from '../orchestrator/advance.ts';

/*
 * Re-running what did not pass, in the same run: failed, cancelled and skipped jobs go back
 * to pending as a new attempt (with fresh logs and test results; earlier failures are kept,
 * because a test that failed and now passes on the same commit is how flakes show), passing
 * jobs keep their
 * results, and the run advances from there. Lost-runner retries still get their two tries
 * on top of the person's.
 */

export async function resetForRerun(tx: SqlExecutor, runId: string): Promise<RunOutcome> {
  const [run] = await tx<{ state: string; failure_reason: string | null }[]>`
    select state, failure_reason from pipeline_runs where id = ${runId} for update`;
  if (!run) throw new NotFoundError('That run does not exist');
  if (run.failure_reason) {
    throw new ValidationError(
      'This run failed before any job started, so no job can re-run. Fix the pipeline, then run it again.',
    );
  }
  if (['queued', 'running', 'waiting'].includes(run.state)) {
    throw new ValidationError('The run is still going. Cancel it first, or wait for it to finish.');
  }
  const jobs = await tx<{ id: string }[]>`
    update pipeline_jobs set
      state = 'pending', attempt = attempt + 1, max_attempts = attempt + 3,
      runner_id = null, token_hash = null, token_expires_at = null, failure_summary = null,
      failure_fingerprint = null, failure_line = null, test_summary = null, ready_at = null,
      claimed_at = null, heartbeat_at = null, started_at = null, finished_at = null,
      updated_at = now()
    where run_id = ${runId} and state in ('failed', 'cancelled', 'skipped')
    returning id`;
  if (jobs.length === 0)
    throw new ValidationError('Every job in this run passed; nothing to re-run.');
  const ids = jobs.map((job) => job.id);
  await tx`
    update pipeline_steps set state = 'pending', exit_code = null, first_line = null,
      line_count = null, started_at = null, finished_at = null, updated_at = now()
    where job_id = any(${ids}::uuid[])`;
  await tx`delete from pipeline_log_chunks where job_id = any(${ids}::uuid[])`;
  await tx`
    update pipeline_runs set state = 'queued', finished_at = null, cancel_reason = null,
      updated_at = now()
    where id = ${runId}`;
  return advanceRun(tx, runId);
}
