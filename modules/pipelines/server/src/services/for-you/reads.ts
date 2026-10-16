import type { SqlExecutor } from '@bemmoly/core';

/*
 * What For you reads for one person, in a few set-based queries: their recent changes, the
 * jobs, releases and environments behind them, and what is open on each release.
 */

export interface ChangeRow {
  id: string;
  title: string;
  commit_sha: string;
  issue_key: string | null;
  state: string;
  repository: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  application_id: string | null;
  application_key: string | null;
  application_name: string | null;
  tier: number | null;
}

export interface JobRow {
  run_id: string;
  name: string;
  kind: string;
  state: string;
  failure_summary: string | null;
  seconds: number | null;
}

export interface ReleaseRow {
  id: string;
  run_id: string;
  application_id: string;
}

export interface PlaceRow {
  application_id: string;
  environment_id: string;
  environment_key: string;
  environment_name: string;
  environment_class: string;
  region: string | null;
  release_id: string | null;
  moving_release_id: string | null;
  state: string | null;
  traffic_percent: number | null;
  deploy_seconds: number | null;
}

export interface OpenPromotionRow {
  id: string;
  release_id: string;
  environment_id: string;
  state: string;
  gates_open: number;
  approvals_have: number;
}

export interface FlakyRow {
  application_id: string;
  file: string;
  failed: number;
  samples: number;
}

/** The person's changes: the latest run per commit they authored in the window. */
export function changes(sql: SqlExecutor, me: string, days: number) {
  return sql<ChangeRow[]>`
    select * from (
      select distinct on (r.commit_sha) r.id, r.title, r.commit_sha, r.issue_key, r.state,
        repo.full_name as repository, r.created_at, r.updated_at,
        a.id as application_id, a.key as application_key, a.name as application_name, a.tier
      from pipeline_runs r
      left join pipeline_repositories repo on repo.id = r.repository_id
      left join lateral (
        select ra.application_id from pipeline_run_applications ra
        where ra.run_id = r.id order by ra.created_at, ra.id limit 1) first on true
      left join pipeline_applications a on a.id = first.application_id
      where r.author_user_id = ${me}::uuid
        and r.created_at > now() - make_interval(days => ${days})
        and r.superseded_by_run_id is null
      order by r.commit_sha, r.created_at desc) latest
    order by created_at desc limit 25`;
}

export function jobs(sql: SqlExecutor, runIds: readonly string[]) {
  return sql<JobRow[]>`
    select run_id, name, kind, state, failure_summary,
      extract(epoch from (finished_at - started_at))::int as seconds
    from pipeline_jobs where run_id = any(${runIds as string[]}::uuid[])
    order by run_id, created_at, key`;
}

export function releases(sql: SqlExecutor, runIds: readonly string[]) {
  return sql<ReleaseRow[]>`
    select distinct on (run_id, application_id) id, run_id, application_id
    from pipeline_releases where run_id = any(${runIds as string[]}::uuid[])
    order by run_id, application_id, created_at desc`;
}

/** Each environment on the applications' paths, with what runs and moves there. */
export function places(sql: SqlExecutor, applicationIds: readonly string[]) {
  return sql<PlaceRow[]>`
    select a.id as application_id, e.id as environment_id, e.key as environment_key,
      e.name as environment_name, e.class as environment_class, e.region,
      c.release_id, c.moving_release_id, c.state, c.traffic_percent,
      extract(epoch from (d.finished_at - d.started_at))::int as deploy_seconds
    from pipeline_applications a
    join pipeline_environments e on e.archived_at is null and (
      not exists (select 1 from pipeline_environment_paths p where p.tier = a.tier)
      or e.id in (select s.environment_id from pipeline_environment_paths p
        join pipeline_environment_path_steps s on s.path_id = p.id where p.tier = a.tier))
    left join pipeline_current c on c.application_id = a.id and c.environment_id = e.id
    left join pipeline_deployments d on d.id = c.deployment_id
    where a.id = any(${applicationIds as string[]}::uuid[])
    order by a.id, e.position, e.id`;
}

export function openPromotions(sql: SqlExecutor, releaseIds: readonly string[]) {
  return sql<OpenPromotionRow[]>`
    select p.id, p.release_id, p.environment_id, p.state,
      (select count(*) from pipeline_gate_results g
        where g.promotion_id = p.id and g.state <> 'pass')::int as gates_open,
      (select count(*) from pipeline_approvals ap
        where ap.promotion_id = p.id and ap.decision = 'approved')::int as approvals_have
    from pipeline_promotions p
    where p.release_id = any(${releaseIds as string[]}::uuid[])
      and p.state in ('requested', 'gating', 'awaiting_approval', 'scheduled', 'rolling_out')
    order by p.created_at desc`;
}

/** The file that fails most often on main for each application, to flag a flaky failure. */
export function flaky(sql: SqlExecutor, applicationIds: readonly string[]) {
  return sql<FlakyRow[]>`
    select distinct on (application_id) application_id, test_file as file,
      length(recent_outcomes) - length(replace(recent_outcomes, 'f', '')) as failed,
      samples
    from pipeline_test_timings
    where application_id = any(${applicationIds as string[]}::uuid[])
      and recent_outcomes like '%f%'
    order by application_id,
      length(recent_outcomes) - length(replace(recent_outcomes, 'f', '')) desc`;
}

export async function shippedThisWeek(sql: SqlExecutor, me: string): Promise<number> {
  const [row] = await sql<{ count: number }[]>`
    select count(distinct rel.id)::int as count
    from pipeline_runs r
    join pipeline_releases rel on rel.run_id = r.id
    join pipeline_deployments d on d.release_id = rel.id and d.state = 'succeeded'
    join pipeline_environments e on e.id = d.environment_id and e.class = 'prod'
    where r.author_user_id = ${me}::uuid and d.finished_at > now() - interval '7 days'`;
  return row?.count ?? 0;
}

export interface DeployedRow {
  release_id: string;
  environment_id: string;
  seconds: number | null;
}

/** Where each release has been deployed already, even if something newer runs there now. */
export function deployedTo(sql: SqlExecutor, releaseIds: readonly string[]) {
  return sql<DeployedRow[]>`
    select distinct on (release_id, environment_id) release_id, environment_id,
      extract(epoch from (finished_at - started_at))::int as seconds
    from pipeline_deployments
    where release_id = any(${releaseIds as string[]}::uuid[]) and state = 'succeeded'
    order by release_id, environment_id, finished_at desc`;
}
