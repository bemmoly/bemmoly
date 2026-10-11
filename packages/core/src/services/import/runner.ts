import type { Logger } from 'pino';
import type { SqlClient } from '../../clients/postgres.ts';
import type { ImportConnection, ImportSourceContext } from '../../contracts/importer.ts';
import type { ObjectStore } from '../../contracts/object-store.ts';
import type { ImporterCatalog } from './define.ts';
import { createRunContext, ImportCancelledError } from './run-context.ts';
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
}

/** Why a run stopped, in words an admin can act on; stack traces stay in the log. */
function reasonOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 1000) || 'The import stopped with an unknown error';
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
    const job = await jobById(sql, jobId);
    const entry = deps.catalog.get(job.source);
    const handle = createRunContext({
      sql,
      job,
      objectStore: deps.objectStore,
      signal,
      fetchFor: deps.fetchFor,
    });
    try {
      if (!entry) throw new Error(`The ${job.source} importer is not enabled`);
      if (!job.plan) throw new Error('The import has no plan; pick what to bring in first');
      await entry.importer.run(deps.connectionOf(job), job.plan, handle.ctx);
      await handle.flush();
      await sql`
        update import_jobs set status = 'completed', phase = null, checkpoint = null,
          progress_done = progress_total, finished_at = now(), updated_at = now()
        where id = ${jobId} and status = 'running'`;
      deps.logger?.info({ importJobId: jobId, report: handle.report.counts }, 'import completed');
    } catch (error) {
      if (error instanceof ImportCancelledError) {
        await sql`update import_jobs set finished_at = now() where id = ${jobId}`;
        return;
      }
      deps.logger?.error({ err: error, importJobId: jobId }, 'import failed');
      await sql`
        update import_jobs set status = 'failed', error = ${reasonOf(error)},
          report = ${JSON.stringify(handle.report)}::jsonb, finished_at = now(),
          updated_at = now()
        where id = ${jobId} and status = 'running'`;
    }
  };
}
