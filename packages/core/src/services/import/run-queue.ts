import { ConflictError, NotFoundError, ValidationError, type RunImportBody } from '@bemmoly/shared';
import type { SqlClient } from '../../clients/postgres.ts';
import type { JobQueue } from '../../contracts/jobs.ts';
import { IMPORT_RUN_JOB } from './runner.ts';
import { jobById, type ImportJobRow } from './store.ts';

const ACTIVE = new Set(['queued', 'running']);

/**
 * Queues a run. After a completed one it starts over and the mappings make that an update;
 * after a failure or a cancel it resumes, each container from its own checkpoint. With
 * `containers` it runs only those again (Retry), leaving the others as they ended.
 */
export async function queueRun(
  sql: SqlClient,
  jobs: JobQueue,
  id: string,
  body: RunImportBody,
): Promise<ImportJobRow> {
  return sql.begin(async (tx) => {
    const row = await jobById(tx, id);
    if (ACTIVE.has(row.status)) throw new ConflictError('The import is already running');
    if (!row.plan) throw new ValidationError('Pick what to bring in before running');
    if (row.plan.targets?.errors) {
      const n = row.plan.targets.errors;
      throw new ValidationError(
        `${n} chosen ${n === 1 ? 'one has' : 'have'} a key that is taken; fix ${n === 1 ? 'it' : 'them'} in Options first`,
      );
    }
    const retry = body.containers ?? null;
    const fresh = !retry && (row.status === 'ready' || row.status === 'completed');
    if (retry) {
      const found = await tx<{ source_id: string }[]>`
        update import_containers set run_status = 'waiting', run_error = null,
          updated_at = now()
        where job_id = ${id} and selected and run_status in ('failed', 'waiting', 'running')
          and source_id = any(${retry}::text[])
        returning source_id`;
      if (found.length !== retry.length) {
        throw new ValidationError('Only projects or spaces that did not finish can be retried');
      }
    } else if (fresh) {
      await tx`
        update import_containers set run_status = case when selected then 'waiting' end,
          run_phase = null, run_done = 0, run_total = coalesce(count, 0), run_error = null,
          run_checkpoint = null, run_result = null, run_finished_at = null
        where job_id = ${id}`;
      await tx`delete from import_skips where job_id = ${id}`;
    } else {
      await tx`
        update import_containers set run_status = 'waiting', run_error = null
        where job_id = ${id} and selected and run_status is distinct from 'done'`;
    }
    const [queued] = await tx<ImportJobRow[]>`
      update import_jobs set status = 'queued', error = null, finished_at = null,
        runs = runs + ${fresh ? 1 : 0},
        checkpoint = ${fresh ? null : tx`checkpoint`},
        report = ${fresh ? tx`'{}'::jsonb` : tx`report`},
        started_at = ${fresh ? null : tx`started_at`},
        progress_done = ${fresh ? 0 : tx`progress_done`},
        progress_total = ${fresh ? 0 : tx`progress_total`}, updated_at = now()
      where id = ${id} returning *`;
    if (!queued) throw new NotFoundError('The import was not found');
    await jobs.enqueue(
      IMPORT_RUN_JOB,
      { importJobId: id },
      { key: `${IMPORT_RUN_JOB}:${id}:${queued.runs}:${Date.now()}`, transaction: tx },
    );
    return queued;
  });
}
