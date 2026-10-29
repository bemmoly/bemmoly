import type { SqlExecutor } from '@bemmoly/core';
import type { Job, RunSummary, Step, WaitReason } from '../../../../shared/runs.ts';
import type { MachineState } from '../../../../shared/machines.ts';
import { iso, isoOrNull } from '../../utils/time.ts';

/*
 * Rows → the run, job and step shapes of the contract. Every summary read goes through
 * `runSummarySelect`, so the list, the detail and the For you cards say the same things.
 */

export interface RunRow {
  id: string;
  number: string | number;
  trigger: RunSummary['trigger'];
  ref: string;
  commit_sha: string;
  title: string;
  pull_request: number | null;
  issue_key: string | null;
  author_id: string | null;
  author_name: string | null;
  author_login: string | null;
  team_id: string | null;
  team_name: string | null;
  repository_id: string | null;
  repository_full_name: string | null;
  repository_url: string | null;
  repository_default_branch: string | null;
  applications: Array<{ id: string; key: string; name: string; tier: number }> | null;
  state: RunSummary['state'];
  priority_class: RunSummary['priorityClass'];
  executor: RunSummary['executor'];
  external_url: string | null;
  superseded_by_run_id: string | null;
  rerun_of_run_id: string | null;
  failure_reason: string | null;
  resolved_spec?: unknown;
  created_at: Date | string;
  started_at: Date | string | null;
  finished_at: Date | string | null;
}

/** The select list and joins for a run summary; callers add where, order and limit. */
export function runSummarySelect(sql: SqlExecutor) {
  return sql`
    select r.id, r.number, r.trigger, r.ref, r.commit_sha, r.title, r.pull_request, r.issue_key,
      u.id as author_id, u.name as author_name, r.author_login, t.id as team_id,
      t.name as team_name, p.id as repository_id, p.full_name as repository_full_name,
      p.url as repository_url, p.default_branch as repository_default_branch,
      (select json_agg(json_build_object('id', a.id, 'key', a.key, 'name', a.name,
          'tier', a.tier) order by ra.created_at)
        from pipeline_run_applications ra join pipeline_applications a on a.id = ra.application_id
        where ra.run_id = r.id) as applications,
      r.state, r.priority_class, r.executor, r.external_url, r.superseded_by_run_id,
      r.rerun_of_run_id, r.failure_reason, r.created_at, r.started_at, r.finished_at
    from pipeline_runs r
    left join users u on u.id = r.author_user_id
    left join teams t on t.id = r.team_id
    left join pipeline_repositories p on p.id = r.repository_id`;
}

export function toRunSummary(row: RunRow): RunSummary {
  const started = row.started_at ? new Date(row.started_at).getTime() : null;
  const finished = row.finished_at ? new Date(row.finished_at).getTime() : null;
  return {
    id: row.id,
    number: Number(row.number),
    trigger: row.trigger,
    ref: row.ref,
    commitSha: row.commit_sha,
    title: row.title,
    pullRequest: row.pull_request,
    issueKey: row.issue_key,
    author: row.author_id
      ? { id: row.author_id, name: row.author_name ?? '', avatarUrl: null }
      : null,
    authorLogin: row.author_login,
    team: row.team_id ? { id: row.team_id, name: row.team_name ?? '' } : null,
    repository: row.repository_id
      ? {
          id: row.repository_id,
          fullName: row.repository_full_name ?? '',
          url: row.repository_url,
          defaultBranch: row.repository_default_branch ?? 'main',
        }
      : null,
    applications: (row.applications ?? []).map((a) => ({
      id: a.id,
      key: a.key,
      name: a.name,
      tier: a.tier as 0 | 1 | 2,
    })),
    state: row.state,
    priorityClass: row.priority_class,
    executor: row.executor,
    externalUrl: row.external_url,
    supersededByRunId: row.superseded_by_run_id,
    rerunOfRunId: row.rerun_of_run_id,
    failureReason: row.failure_reason,
    createdAt: iso(row.created_at),
    startedAt: isoOrNull(row.started_at),
    finishedAt: isoOrNull(row.finished_at),
    durationSeconds:
      started !== null ? Math.round(((finished ?? Date.now()) - started) / 1000) : null,
  };
}

export interface JobRow {
  id: string;
  run_id: string;
  application_id: string | null;
  application_key: string | null;
  application_name: string | null;
  application_tier: number | null;
  key: string;
  name: string;
  kind: Job['kind'];
  needs: string[];
  state: Job['state'];
  pool_id: string | null;
  pool_key: string | null;
  pool_name: string | null;
  pool_hosting: string | null;
  team_id: string | null;
  priority: number;
  shard_index: number | null;
  shard_total: number | null;
  attempt: number;
  max_attempts: number;
  timeout_minutes: number;
  failure_summary: string | null;
  failure_fingerprint: string | null;
  matrix: Record<string, string | number | boolean> | null;
  ready_at: Date | string | null;
  started_at: Date | string | null;
  finished_at: Date | string | null;
  machine: {
    state: MachineState;
    ref: string | null;
    log_url: string | null;
    error: string | null;
  } | null;
  steps: Array<{
    id: string;
    position: number;
    name: string;
    image: string | null;
    run: string | null;
    uses: string | null;
    locked: boolean;
    state: Step['state'];
    exit_code: number | null;
    first_line: number | null;
    line_count: number | null;
    started_at: string | null;
    finished_at: string | null;
  }> | null;
}

export function jobsSelect(sql: SqlExecutor) {
  return sql`
    select j.id, j.run_id, a.id as application_id, a.key as application_key,
      a.name as application_name, a.tier as application_tier, j.key, j.name, j.kind, j.needs,
      j.state, j.pool_id, p.key as pool_key, p.name as pool_name, p.hosting as pool_hosting,
      j.team_id, j.priority,
      j.shard_index, j.shard_total, j.attempt, j.max_attempts, j.timeout_minutes,
      j.failure_summary, j.failure_fingerprint, j.matrix, j.ready_at, j.started_at, j.finished_at,
      (select json_agg(json_build_object('id', s.id, 'position', s.position, 'name', s.name,
          'image', s.image, 'run', s.run, 'uses', s.uses, 'locked', s.locked, 'state', s.state,
          'exit_code', s.exit_code, 'first_line', s.first_line, 'line_count', s.line_count,
          'started_at', s.started_at, 'finished_at', s.finished_at) order by s.position)
        from pipeline_steps s where s.job_id = j.id) as steps,
      (select json_build_object('state', l.state, 'ref', l.external_ref, 'log_url', l.log_url,
          'error', l.error)
        from pipeline_runner_launches l where l.job_id = j.id
        order by l.created_at desc limit 1) as machine
    from pipeline_jobs j
    left join pipeline_applications a on a.id = j.application_id
    left join pipeline_runner_pools p on p.id = j.pool_id`;
}

export function toJob(row: JobRow, waitReason: WaitReason | null): Job {
  return {
    id: row.id,
    runId: row.run_id,
    application: row.application_id
      ? {
          id: row.application_id,
          key: row.application_key ?? '',
          name: row.application_name ?? '',
          tier: (row.application_tier ?? 2) as 0 | 1 | 2,
        }
      : null,
    key: row.key,
    name: row.name,
    kind: row.kind,
    needs: row.needs,
    state: row.state,
    pool: row.pool_id
      ? { id: row.pool_id, key: row.pool_key ?? '', name: row.pool_name ?? '' }
      : null,
    shardIndex: row.shard_index,
    shardTotal: row.shard_total,
    attempt: row.attempt,
    maxAttempts: row.max_attempts,
    timeoutMinutes: row.timeout_minutes,
    failureSummary: row.failure_summary,
    failureFingerprint: row.failure_fingerprint,
    matrix: row.matrix,
    waitReason,
    readyAt: isoOrNull(row.ready_at),
    startedAt: isoOrNull(row.started_at),
    finishedAt: isoOrNull(row.finished_at),
    machine: row.machine
      ? {
          state: row.machine.state,
          ref: row.machine.ref,
          logUrl: row.machine.log_url,
          error: row.machine.error,
        }
      : null,
    steps: (row.steps ?? []).map((step) => ({
      id: step.id,
      position: step.position,
      name: step.name,
      image: step.image,
      run: step.run,
      uses: step.uses,
      locked: step.locked,
      state: step.state,
      exitCode: step.exit_code,
      firstLine: step.first_line,
      lineCount: step.line_count,
      startedAt: isoOrNull(step.started_at),
      finishedAt: isoOrNull(step.finished_at),
    })),
  };
}
