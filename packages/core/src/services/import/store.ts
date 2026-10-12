import {
  NotFoundError,
  type ImportJobDiscovery,
  type ImportJob,
  type ImportJobStatus,
  type ImportPlan,
  type ImportReport,
} from '@bemmoly/shared';
import type { SqlClient } from '../../clients/postgres.ts';
import type { SqlExecutor } from '../../contracts/sql.ts';

export interface ImportJobRow {
  id: string;
  source: string;
  site: string;
  connection: Record<string, string | boolean>;
  credentials: string | null;
  status: ImportJobStatus;
  /** Older jobs still carry their containers here; newer ones a total, the rows elsewhere. */
  discovery:
    (Omit<ImportJobDiscovery, 'total'> & { total?: number; containers?: unknown[] }) | null;
  plan: ImportPlan | null;
  phase: string | null;
  progress_done: number;
  progress_total: number;
  checkpoint: unknown;
  report: Partial<ImportReport>;
  error: string | null;
  runs: number;
  created_by: string | null;
  started_at: Date | string | null;
  finished_at: Date | string | null;
  created_at: Date | string;
  /** Where the chosen containers are in the run; read with JOB_COLUMNS only. */
  containers_summary?: {
    total: number;
    waiting: number;
    running: number;
    done: number;
    failed: number;
  } | null;
}

export const JOB_COLUMNS = `id, source, site, connection, credentials, status, discovery, plan,
  phase, progress_done, progress_total, checkpoint, report, error, runs, created_by,
  started_at, finished_at, created_at,
  (select json_build_object('total', count(*), 'waiting', count(*) filter (where c.run_status = 'waiting'),
    'running', count(*) filter (where c.run_status = 'running'),
    'done', count(*) filter (where c.run_status = 'done'),
    'failed', count(*) filter (where c.run_status = 'failed'))
   from import_containers c where c.job_id = import_jobs.id and c.selected
     and c.run_status is not null) as containers_summary`;

export const emptyReport = (): ImportReport => ({
  counts: {},
  skipped: [],
  skippedTotal: 0,
  warnings: [],
});

const iso = (value: Date | string | null) => (value ? new Date(value).toISOString() : null);

/** The client's view of a job: the credentials column never leaves the server. */
export function toImportJob(row: ImportJobRow, sourceLabel: string): ImportJob {
  return {
    id: row.id,
    source: row.source,
    sourceLabel,
    status: row.status,
    phase: row.phase,
    progress: { done: row.progress_done, total: row.progress_total },
    connection: row.connection,
    discovery: row.discovery
      ? {
          site: row.discovery.site,
          counts: row.discovery.counts,
          warnings: row.discovery.warnings,
          total: row.discovery.total ?? row.discovery.containers?.length ?? 0,
        }
      : null,
    plan: row.plan,
    report: { ...emptyReport(), ...row.report },
    error: row.error,
    runs: row.runs,
    ...(row.containers_summary && row.containers_summary.total > 0
      ? { containers: row.containers_summary }
      : {}),
    createdAt: new Date(row.created_at).toISOString(),
    startedAt: iso(row.started_at),
    finishedAt: iso(row.finished_at),
  };
}

export async function jobById(sql: SqlExecutor, id: string): Promise<ImportJobRow> {
  const [row] = await sql<ImportJobRow[]>`
    select ${sql.unsafe(JOB_COLUMNS)} from import_jobs where id = ${id}`;
  if (!row) throw new NotFoundError('The import was not found');
  return row;
}

export async function listJobs(sql: SqlClient, limit: number): Promise<ImportJobRow[]> {
  return sql<ImportJobRow[]>`
    select ${sql.unsafe(JOB_COLUMNS)} from import_jobs order by id desc limit ${limit}`;
}

export interface NewImportJob {
  source: string;
  site: string;
  connection: Record<string, string | boolean>;
  credentials: string | null;
  discovery: Omit<ImportJobDiscovery, 'total'> & { total: number };
  createdBy: string | null;
}

export async function insertJob(sql: SqlExecutor, job: NewImportJob): Promise<ImportJobRow> {
  const [row] = await sql<ImportJobRow[]>`
    insert into import_jobs (source, site, connection, credentials, discovery, created_by)
    values (${job.source}, ${job.site}, ${JSON.stringify(job.connection)}::jsonb,
      ${job.credentials}, ${JSON.stringify(job.discovery)}::jsonb, ${job.createdBy}::uuid)
    returning ${sql.unsafe(JOB_COLUMNS)}`;
  if (!row) throw new Error('The import was not stored');
  return row;
}
