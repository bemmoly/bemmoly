import type { World } from './world.ts';

/*
 * What the nightly job and the writers would have computed from the history: daily
 * delivery rollups per application (runs, Prod deploys, failures, roll backs, median lead
 * time from commit to Prod), and each application's last Prod deploy and health.
 */

export async function computeRollups(world: World) {
  const { sql } = world;
  await sql`
    with runs as (
      select ra.application_id, r.created_at::date as day, count(*)::int as runs,
        count(*) filter (where r.state = 'failed')::int as failed_runs,
        coalesce(sum(extract(epoch from (r.finished_at - r.started_at))) / 60, 0)::int as minutes
      from pipeline_run_applications ra join pipeline_runs r on r.id = ra.run_id
      where r.finished_at is not null
      group by 1, 2),
    deploys as (
      select d.application_id, d.created_at::date as day,
        count(*) filter (where d.kind = 'deploy')::int as prod_deploys,
        count(*) filter (where d.state = 'failed')::int as failed_deploys,
        count(*) filter (where d.state = 'rolled_back')::int as rollbacks,
        (percentile_cont(0.5) within group (
          order by extract(epoch from d.finished_at - coalesce(r.created_at, rel.created_at)))
          filter (where d.state = 'succeeded' and d.kind = 'deploy'))::int as lead_time
      from pipeline_deployments d
      join pipeline_environments e on e.id = d.environment_id and e.class = 'prod'
      join pipeline_releases rel on rel.id = d.release_id
      left join pipeline_runs r on r.id = rel.run_id
      where d.finished_at is not null
      group by 1, 2)
    insert into pipeline_daily_rollups (application_id, day, runs, failed_runs, prod_deploys,
      failed_deploys, rollbacks, lead_time_p50_seconds, build_minutes)
    select coalesce(runs.application_id, deploys.application_id), coalesce(runs.day, deploys.day),
      coalesce(runs.runs, 0), coalesce(runs.failed_runs, 0), coalesce(deploys.prod_deploys, 0),
      coalesce(deploys.failed_deploys, 0), coalesce(deploys.rollbacks, 0), deploys.lead_time,
      coalesce(runs.minutes, 0)
    from runs full join deploys
      on deploys.application_id = runs.application_id and deploys.day = runs.day`;
  await sql`
    update pipeline_applications a set last_deployed_at = latest.at
    from (
      select d.application_id, max(d.finished_at) as at
      from pipeline_deployments d join pipeline_environments e on e.id = d.environment_id
      where e.class = 'prod' and d.state = 'succeeded'
      group by 1) latest
    where latest.application_id = a.id`;
  await sql`
    update pipeline_applications set last_deployed_at = ${new Date(world.now.getTime() - 97 * 86_400_000).toISOString()}::timestamptz
    where key = 'gift-cards'`;
  await sql`
    update pipeline_applications a set health = case
      when exists (select 1 from pipeline_current c where c.application_id = a.id and c.state = 'failed')
        or (select r.state from pipeline_run_applications ra join pipeline_runs r on r.id = ra.run_id
            where ra.application_id = a.id and r.ref = 'main' and r.state in ('passed', 'failed')
            order by r.created_at desc limit 1) = 'failed'
        then 'failing'
      when exists (select 1 from pipeline_current c where c.application_id = a.id and c.state = 'rolled_back')
        or exists (select 1 from pipeline_deployments d where d.application_id = a.id
          and d.state = 'rolled_back' and d.created_at > now() - interval '3 days')
        then 'degraded'
      when a.last_deployed_at is not null
        or exists (select 1 from pipeline_current c where c.application_id = a.id and c.release_id is not null)
        then 'healthy'
      else 'unknown' end`;
  const [counts] = await sql<
    { rollups: number }[]
  >`select count(*)::int as rollups from pipeline_daily_rollups`;
  world.log(`${counts?.rollups ?? 0} daily rollups, health and last deploys`);
}

/** The demo person shipped eleven Payments changes to every Prod region this week. */
export async function creditShippedWork(world: World) {
  await world.sql`
    with shipped as (
      select distinct rel.run_id
      from pipeline_deployments d
      join pipeline_environments e on e.id = d.environment_id and e.key = 'prod-eu-west1'
      join pipeline_releases rel on rel.id = d.release_id
      join pipeline_applications a on a.id = rel.application_id
      join teams t on t.id = a.owner_team_id and t.name = 'Payments'
      where d.state = 'succeeded' and d.finished_at > now() - interval '7 days'
        and rel.run_id is not null
      limit 11)
    update pipeline_runs set author_user_id = ${world.demo.id}
    where id in (select run_id from shipped)`;
  await world.sql`
    update pipeline_releases set created_by = ${world.demo.id}
    where run_id in (select id from pipeline_runs where author_user_id = ${world.demo.id})`;
}
