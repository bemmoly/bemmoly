import { decodeCursor, toPage, type SqlExecutor } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type { GlyphState } from '../../../../shared/common.ts';
import type {
  Job,
  ListRunsQuery,
  RunDetail,
  RunGraph,
  RunsPage,
  TestSummary,
} from '../../../../shared/runs.ts';
import { stagesOf } from '../orchestrator/expand.ts';
import { escapeLike } from '../../utils/time.ts';
import {
  jobsSelect,
  runSummarySelect,
  toJob,
  toRunSummary,
  type JobRow,
  type RunRow,
} from './present.ts';
import { waitReasons } from './waits.ts';

/*
 * The run reads: the keyset list, one run with its jobs, steps and failed tests, and the
 * stage graph. Each is a fixed number of queries whatever the run's size.
 */

export async function listRuns(
  sql: SqlExecutor,
  query: ListRunsQuery,
  me: string | null,
): Promise<RunsPage> {
  const after = decodeCursor(query.cursor);
  const [domain, group] = (query.scope ?? '').split('/');
  const rows = await sql<RunRow[]>`
    ${runSummarySelect(sql)}
    where true
      ${after ? sql`and r.id < ${after}::uuid` : sql``}
      ${query.state?.length ? sql`and r.state = any(${query.state}::text[])` : sql``}
      ${query.trigger ? sql`and r.trigger = ${query.trigger}` : sql``}
      ${query.branch ? sql`and r.ref = ${query.branch}` : sql``}
      ${query.repository ? sql`and p.full_name = ${query.repository}` : sql``}
      ${query.mine ? sql`and r.author_user_id = ${me}::uuid` : sql``}
      ${
        query.q
          ? sql`and (r.title ilike ${`%${escapeLike(query.q)}%`}
              or r.commit_sha like ${`${escapeLike(query.q.toLowerCase())}%`})`
          : sql``
      }
      ${
        query.application || domain
          ? sql`and exists (
              select 1 from pipeline_run_applications ra
              join pipeline_applications a on a.id = ra.application_id
              join pipeline_domains d on d.id = a.domain_id
              join pipeline_groups g on g.id = a.group_id
              where ra.run_id = r.id
                ${query.application ? sql`and a.key = ${query.application}` : sql``}
                ${domain ? sql`and d.key = ${domain}` : sql``}
                ${group ? sql`and g.key = ${group}` : sql``})`
          : sql``
      }
    order by r.id desc
    limit ${query.limit + 1}`;
  const page = toPage(rows, query.limit);
  return { items: page.rows.map(toRunSummary), nextCursor: page.nextCursor };
}

async function runJobs(sql: SqlExecutor, runId: string): Promise<Job[]> {
  const rows = await sql<JobRow[]>`
    ${jobsSelect(sql)} where j.run_id = ${runId} order by j.created_at, j.id`;
  const reasons = await waitReasons(sql, rows);
  return rows.map((row) => toJob(row, reasons.get(row.id) ?? null));
}

async function testSummary(sql: SqlExecutor, runId: string): Promise<TestSummary | null> {
  const [totals] = await sql<
    {
      reports: number;
      total: number;
      passed: number;
      failed: number;
      skipped: number;
      quarantined: number;
    }[]
  >`
    select count(test_summary)::int as reports,
      coalesce(sum((test_summary->>'total')::int), 0)::int as total,
      coalesce(sum((test_summary->>'passed')::int), 0)::int as passed,
      coalesce(sum((test_summary->>'failed')::int), 0)::int as failed,
      coalesce(sum((test_summary->>'skipped')::int), 0)::int as skipped,
      coalesce(sum((test_summary->>'quarantined')::int), 0)::int as quarantined
    from pipeline_jobs where run_id = ${runId} and test_summary is not null`;
  if (!totals || totals.reports === 0) return null;
  const failures = await sql<
    {
      file: string;
      name: string;
      line: number | null;
      message: string | null;
      job_id: string;
      recent: string;
      quarantined: boolean;
      fingerprint: string | null;
    }[]
  >`
    select t.file, t.name, f.line, f.message, f.job_id, t.recent_outcomes as recent,
      f.quarantined, f.fingerprint
    from pipeline_test_failures f join pipeline_tests t on t.id = f.test_id
    join pipeline_jobs j on j.id = f.job_id
    where f.run_id = ${runId} and f.created_at >= j.claimed_at
    order by f.quarantined, t.file, t.name limit 200`;
  return {
    total: totals.total,
    passed: totals.passed,
    failed: totals.failed,
    skipped: totals.skipped,
    quarantined: totals.quarantined,
    failures: failures.map((row) => ({
      file: row.file,
      line: row.line,
      name: row.name,
      message: row.message,
      jobId: row.job_id,
      flakiness:
        row.recent.length > 0
          ? {
              failedRecent: [...row.recent].filter((o) => o === 'f').length,
              ofRecent: row.recent.length,
            }
          : null,
      quarantined: row.quarantined,
      fingerprint: row.fingerprint,
    })),
  };
}

async function runRow(sql: SqlExecutor, runId: string): Promise<RunRow> {
  const [row] = await sql<RunRow[]>`
    select s.*, r2.resolved_spec from (${runSummarySelect(sql)} where r.id = ${runId}) s
    join pipeline_runs r2 on r2.id = s.id`;
  if (!row) throw new NotFoundError('That run does not exist');
  return row;
}

export async function readRun(sql: SqlExecutor, runId: string): Promise<RunDetail> {
  const row = await runRow(sql, runId);
  return {
    ...toRunSummary(row),
    jobs: await runJobs(sql, runId),
    tests: await testSummary(sql, runId),
    resolvedSpec: row.resolved_spec ?? null,
  };
}

const GLYPH: Record<Job['state'], GlyphState> = {
  pending: 'queued',
  ready: 'queued',
  claimed: 'queued',
  running: 'running',
  passed: 'passed',
  failed: 'failed',
  cancelled: 'skipped',
  skipped: 'skipped',
};

export function duration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`;
}

function detailOf(job: Job, failedTests: number): string {
  if (job.state === 'pending') return job.waitReason?.text ?? 'Waiting';
  if (job.state === 'ready' || job.state === 'claimed') return job.waitReason?.text ?? 'Queued';
  if (job.state === 'cancelled') return 'Cancelled';
  if (job.state === 'skipped') return 'Skipped';
  const end = job.finishedAt ? Date.parse(job.finishedAt) : Date.now();
  const took = job.startedAt ? duration(Math.round((end - Date.parse(job.startedAt)) / 1000)) : '';
  return failedTests > 0 ? `${failedTests} failed · ${took}` : took;
}

export async function readGraph(sql: SqlExecutor, runId: string): Promise<RunGraph> {
  await runRow(sql, runId);
  const jobs = await runJobs(sql, runId);
  const failed = await sql<{ job_id: string; count: number }[]>`
    select f.job_id, count(*)::int as count from pipeline_test_failures f
    join pipeline_jobs j on j.id = f.job_id
    where f.run_id = ${runId} and not f.quarantined and f.created_at >= j.claimed_at
    group by f.job_id`;
  const failedBy = new Map(failed.map((row) => [row.job_id, row.count]));
  const stage = stagesOf(jobs);
  const nodes = jobs.map((job) => ({
    jobId: job.id,
    key: job.key,
    name: job.name,
    state: GLYPH[job.state],
    detail: detailOf(job, failedBy.get(job.id) ?? 0),
    stage: stage.get(job.key) ?? 0,
  }));
  const indexes = [...new Set(nodes.map((node) => node.stage))].sort((a, b) => a - b);
  const focus =
    jobs.find((job) => job.state === 'failed') ?? jobs.find((job) => job.state === 'running');
  return {
    runId,
    stages: indexes.map((index) => ({ index, nodes: nodes.filter((n) => n.stage === index) })),
    edges: jobs.flatMap((job) => job.needs.map((need) => ({ from: need, to: job.key }))),
    focus: focus?.key ?? null,
  };
}
