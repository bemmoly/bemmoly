import type { SqlClient } from '@bemmoly/core';
import type { CodeCheckReport } from '@bemmoly/core';
import type { PipelinesCodeHosts } from '../code/hosts.ts';

/*
 * A job's state as a check run on the commit (architecture §8): reported once per job state
 * change, never per log line, through a job so a slow or rate-limited host never holds a
 * runner's call. The first report creates the check; later ones update it by its id.
 */

export const REPORT_CHECK_JOB = 'pipelines.report-check';

const CONCLUSION: Record<string, CodeCheckReport['conclusion']> = {
  passed: 'success',
  failed: 'failure',
  cancelled: 'cancelled',
  skipped: 'skipped',
};

interface CheckRow {
  name: string;
  state: string;
  failure_summary: string | null;
  check_external_id: string | null;
  commit_sha: string;
  run_number: number;
  application_key: string | null;
  full_name: string | null;
}

export async function reportJobCheck(
  sql: SqlClient,
  hosts: PipelinesCodeHosts | undefined,
  jobId: string,
  publicUrl?: string,
): Promise<boolean> {
  if (!hosts) return false;
  const [job] = await sql<CheckRow[]>`
    select j.name, j.state, j.failure_summary, j.check_external_id, r.commit_sha,
      r.number as run_number, a.key as application_key, p.full_name
    from pipeline_jobs j
    join pipeline_runs r on r.id = j.run_id
    left join pipeline_applications a on a.id = j.application_id
    left join pipeline_repositories p on p.id = r.repository_id
    where j.id = ${jobId}`;
  if (!job?.full_name) return false;
  const client = await hosts.client(job.full_name, 'live');
  if (!client) return false;
  const done = CONCLUSION[job.state];
  const name = job.application_key ? `${job.application_key} · ${job.name}` : job.name;
  const report: CodeCheckReport = {
    repository: job.full_name,
    headSha: job.commit_sha,
    name: `Bemmoly · ${name}`,
    status: done ? 'completed' : job.state === 'running' ? 'in_progress' : 'queued',
    ...(done ? { conclusion: done } : {}),
    ...(job.check_external_id ? { externalId: job.check_external_id } : {}),
    ...(publicUrl ? { detailsUrl: `${publicUrl}/pipelines/jobs/${jobId}` } : {}),
    title: done
      ? `${name}: ${job.state}`
      : `${name}: ${job.state === 'running' ? 'running' : 'queued'}`,
    ...(job.failure_summary ? { summary: job.failure_summary } : {}),
  };
  const { externalId } = await client.reportCheck(report);
  await sql`update pipeline_jobs set check_external_id = ${externalId} where id = ${jobId}`;
  return true;
}
