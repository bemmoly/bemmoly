import type { SqlExecutor } from '@bemmoly/core';
import type { TestCaseResult, TestReportUpload } from '../../../../shared/runner.ts';
import { testReportUploadSchema } from '../../../../shared/runner.ts';
import { fingerprintOf } from './fingerprint.ts';
import { isIntermittent, pushOutcome } from './flaky.ts';

/*
 * One job's JUnit summary: stored on the job, folded into per-file timings (for shard
 * splits), and turned into per-test history. Only tests that ever failed get a row, so a
 * suite of 50,000 passing tests costs one timings upsert per file, not 50,000 rows.
 */

export interface ReportJob {
  id: string;
  run_id: string;
  application_id: string | null;
  commit_sha: string;
  /** True on the repository's default branch, where outcomes count toward flakiness. */
  mainline: boolean;
}

/** Moving average, so one slow run moves a file's timing but does not own it. */
const TIMING_WEIGHT = 0.3;

async function foldTimings(tx: SqlExecutor, applicationId: string, cases: TestCaseResult[]) {
  const files = new Map<string, { ms: number; failed: boolean }>();
  for (const result of cases) {
    const file = files.get(result.file) ?? { ms: 0, failed: false };
    file.ms += result.durationMs;
    file.failed ||= result.outcome === 'failed';
    files.set(result.file, file);
  }
  if (files.size === 0) return;
  const names = [...files.keys()];
  await tx`
    insert into pipeline_test_timings (application_id, test_file, duration_ms, recent_outcomes,
      last_failed_at)
    select ${applicationId}, f.file, f.ms, f.outcome,
      case when f.outcome = 'f' then now() end
    from unnest(${names}::text[], ${names.map((n) => files.get(n)?.ms ?? 0)}::int[],
      ${names.map((n) => (files.get(n)?.failed ? 'f' : 'p'))}::text[]) as f(file, ms, outcome)
    on conflict (application_id, test_file) do update set
      duration_ms = round(pipeline_test_timings.duration_ms * ${1 - TIMING_WEIGHT}::numeric
        + excluded.duration_ms * ${TIMING_WEIGHT}::numeric)::int,
      samples = pipeline_test_timings.samples + 1,
      recent_outcomes = right(pipeline_test_timings.recent_outcomes || excluded.recent_outcomes, 50),
      last_failed_at = coalesce(excluded.last_failed_at, pipeline_test_timings.last_failed_at),
      updated_at = now()`;
}

interface TestRow {
  id: string;
  file: string;
  name: string;
  recent_outcomes: string;
  flaky: string | null;
  quarantined_at: Date | string | null;
}

/** Rows for every failed test (created when new) and every reported test that has one. */
async function testRows(tx: SqlExecutor, applicationId: string, cases: TestCaseResult[]) {
  const failed = cases.filter((c) => c.outcome === 'failed');
  if (failed.length > 0) {
    await tx`
      insert into pipeline_tests (application_id, file, name)
      select ${applicationId}, f.file, f.name
      from unnest(${failed.map((c) => c.file)}::text[], ${failed.map((c) => c.name)}::text[])
        as f(file, name)
      on conflict (application_id, file, name) do nothing`;
  }
  const reported = cases.filter((c) => c.outcome !== 'skipped');
  return tx<TestRow[]>`
    select t.id, t.file, t.name, t.recent_outcomes, t.flaky, t.quarantined_at
    from pipeline_tests t
    join unnest(${reported.map((c) => c.file)}::text[], ${reported.map((c) => c.name)}::text[])
      as r(file, name) on r.file = t.file and r.name = t.name
    where t.application_id = ${applicationId}`;
}

export async function ingestReport(
  tx: SqlExecutor,
  job: ReportJob,
  upload: TestReportUpload,
): Promise<{ quarantined: number; failed: number }> {
  const report = testReportUploadSchema.parse(upload);
  let quarantined = 0;
  if (job.application_id) {
    await foldTimings(tx, job.application_id, report.cases);
    const rows = await testRows(tx, job.application_id, report.cases);
    const byName = new Map(rows.map((row) => [`${row.file}\u0000${row.name}`, row]));
    const earlierFailures = new Set(
      (
        await tx<{ test_id: string }[]>`
          select distinct test_id from pipeline_test_failures
          where application_id = ${job.application_id} and commit_sha = ${job.commit_sha}`
      ).map((row) => row.test_id),
    );
    for (const result of report.cases) {
      const row = byName.get(`${result.file}\u0000${result.name}`);
      if (!row || result.outcome === 'skipped') continue;
      const outcome = result.outcome === 'failed' ? 'f' : 'p';
      const recent = job.mainline ? pushOutcome(row.recent_outcomes, outcome) : row.recent_outcomes;
      const retried = outcome === 'p' && earlierFailures.has(row.id);
      const flaky =
        row.flaky ?? (retried ? 'retry' : isIntermittent(recent) ? 'intermittent' : null);
      await tx`
        update pipeline_tests set recent_outcomes = ${recent}, flaky = ${flaky},
          flaky_since = case when ${flaky !== null} then coalesce(flaky_since, now()) end,
          last_failed_at = case when ${outcome === 'f'} then now() else last_failed_at end,
          updated_at = now()
        where id = ${row.id}`;
      if (outcome !== 'f') continue;
      const isQuarantined = row.quarantined_at !== null;
      if (isQuarantined) quarantined += 1;
      await tx`
        insert into pipeline_test_failures
          (test_id, job_id, run_id, application_id, commit_sha, line, message, fingerprint,
           quarantined)
        values (${row.id}, ${job.id}, ${job.run_id}, ${job.application_id}, ${job.commit_sha},
          ${result.line}, ${result.message}, ${fingerprintOf(result.message?.split('\n')[0])},
          ${isQuarantined})`;
    }
  }
  const summary = {
    total: report.total,
    passed: report.passed,
    failed: report.failed,
    skipped: report.skipped,
    durationMs: report.durationMs,
    quarantined,
  };
  // A job may upload several reports (one per step); they add up.
  await tx`
    update pipeline_jobs set test_summary = case when test_summary is null
      then ${JSON.stringify(summary)}::jsonb
      else jsonb_build_object(
        'total', (test_summary->>'total')::int + ${summary.total},
        'passed', (test_summary->>'passed')::int + ${summary.passed},
        'failed', (test_summary->>'failed')::int + ${summary.failed},
        'skipped', (test_summary->>'skipped')::int + ${summary.skipped},
        'durationMs', (test_summary->>'durationMs')::int + ${summary.durationMs},
        'quarantined', (test_summary->>'quarantined')::int + ${summary.quarantined})
      end, updated_at = now()
    where id = ${job.id}`;
  return { quarantined, failed: report.failed };
}
