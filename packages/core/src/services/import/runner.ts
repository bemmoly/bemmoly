import type { ImportCount } from '@bemmoly/shared';
import type { Logger } from 'pino';
import type { EventBus } from '../../contracts/event-bus.ts';
import type { SqlClient } from '../../clients/postgres.ts';
import type {
  ImportConnection,
  ImportRunTarget,
  ImportSourceContext,
} from '../../contracts/importer.ts';
import type { ObjectStore } from '../../contracts/object-store.ts';
import type { ImporterCatalog } from './define.ts';
import { createRunContext, ImportCancelledError } from './run-context.ts';
import { outcomeOf, tellStarter } from './finish.ts';
import { peopleOverrides } from './people-plan.ts';
import { reasonOf } from './reasons.ts';
import { jobById } from './store.ts';

/** The pg-boss job that runs one import; its payload is the import_jobs id. */
export const IMPORT_RUN_JOB = 'import.run';

export interface ImportRunnerDeps {
  sql: SqlClient;
  catalog: ImporterCatalog;
  objectStore: ObjectStore;
  fetchFor: ImportSourceContext['fetchFor'];
  /** The connection with its secrets opened. */
  connectionOf(row: {
    source: string;
    connection: unknown;
    credentials: string | null;
  }): ImportConnection;
  logger?: Pick<Logger, 'info' | 'warn' | 'error'>;
  /** Where the Inbox line is published when a run ends. */
  events?: EventBus;
}

/** Where the plan sent each chosen container. */
async function runTargets(sql: SqlClient, jobId: string): Promise<Map<string, ImportRunTarget>> {
  const rows = await sql<
    {
      source_id: string;
      target_mode: ImportRunTarget['mode'];
      target_key: string;
      target_id: string | null;
    }[]
  >`
    select source_id, target_mode, target_key, target_id from import_containers
    where job_id = ${jobId} and selected and target_mode is not null`;
  return new Map(
    rows.map((row) => [
      row.source_id,
      { mode: row.target_mode, key: row.target_key, id: row.target_id },
    ]),
  );
}

/** What each container counted in earlier runs of the job, so a Retry adds to it. */
async function countedBefore(sql: SqlClient, jobId: string) {
  const rows = await sql<{ source_id: string; counts: Record<string, ImportCount> | null }[]>`
    select source_id, run_result->'counts' as counts from import_containers
    where job_id = ${jobId} and selected and run_result is not null`;
  return new Map(rows.map((row) => [row.source_id, row.counts ?? {}]));
}

/**
 * Runs an import job. A job is claimed by moving it from queued (or from running, when the
 * queue re-delivers after a worker died) to running; the importer then resumes from the
 * checkpoint it saved. A failure is recorded on the job rather than retried blindly: the
 * admin sees why, and Resume continues from the same checkpoint.
 */
export function createImportRunner(deps: ImportRunnerDeps) {
  const { sql } = deps;
  return async function execute(jobId: string, signal: AbortSignal): Promise<void> {
    const [claimed] = await sql<{ id: string }[]>`
      update import_jobs set status = 'running', error = null,
        started_at = coalesce(started_at, now()), updated_at = now()
      where id = ${jobId} and status in ('queued', 'running')
      returning id`;
    if (!claimed) return;
    // The overall bar's total is every chosen record, known from the start; it only grows.
    await sql`
      update import_jobs set progress_total = greatest(progress_total, coalesce((
        select sum(count) from import_containers where job_id = ${jobId} and selected), 0))
      where id = ${jobId}`;
    const job = await jobById(sql, jobId);
    const entry = deps.catalog.get(job.source);
    const label = entry?.importer.label ?? job.source;
    const handle = createRunContext({
      sql,
      job,
      targets: await runTargets(sql, jobId),
      people: await peopleOverrides(sql, jobId),
      counted: await countedBefore(sql, jobId),
      sourceLabel: label,
      ...(entry?.importer.targetPath ? { pathOf: entry.importer.targetPath } : {}),
      objectStore: deps.objectStore,
      signal,
      fetchFor: deps.fetchFor,
    });
    // Told before the status changes, so whoever sees the job finished finds the Inbox line.
    const tell = async (outcome: Awaited<ReturnType<typeof outcomeOf>>) => {
      try {
        await tellStarter(deps.events, job, label, outcome, entry?.importer.nouns);
      } catch (error) {
        // The run's result stands whether or not the Inbox line could be queued.
        deps.logger?.warn({ err: error, importJobId: jobId }, 'import notice not sent');
      }
    };
    try {
      if (!entry) throw new Error(`The ${job.source} importer is not enabled`);
      if (!job.plan) throw new Error('The import has no plan; pick what to bring in first');
      await entry.importer.run(deps.connectionOf(job), job.plan, handle.ctx);
      await handle.flush();
      // An importer that brings everything in one go (a CSV file) finishes its containers too.
      await sql`
        update import_containers set run_status = 'done', run_phase = null,
          run_finished_at = now()
        where job_id = ${jobId} and selected and run_status = 'waiting'
          and not exists (select 1 from import_containers c where c.job_id = ${jobId}
            and c.selected and c.run_status <> 'waiting')`;
      const outcome = await outcomeOf(sql, jobId);
      await tell(outcome);
      await sql`
        update import_jobs set status = ${outcome.status}, error = ${outcome.error},
          phase = null, checkpoint = null,
          progress_done = ${outcome.status === 'completed' ? sql`progress_total` : sql`progress_done`},
          finished_at = now(), updated_at = now()
        where id = ${jobId} and status = 'running'`;
      deps.logger?.info(
        { importJobId: jobId, status: outcome.status, report: handle.report.counts },
        'import finished',
      );
    } catch (error) {
      if (error instanceof ImportCancelledError) {
        await sql`update import_jobs set finished_at = now() where id = ${jobId}`;
        return;
      }
      deps.logger?.error({ err: error, importJobId: jobId }, 'import failed');
      const outcome = {
        ...(await outcomeOf(sql, jobId)),
        status: 'failed' as const,
        error: reasonOf(error, label),
      };
      await tell(outcome);
      await sql`
        update import_jobs set status = 'failed', error = ${outcome.error},
          report = ${JSON.stringify(handle.report)}::jsonb, finished_at = now(),
          updated_at = now()
        where id = ${jobId} and status = 'running'`;
    }
  };
}
