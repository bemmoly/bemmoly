import type { SqlExecutor } from '@bemmoly/core';
import type { Tier } from '../../../../shared/common.ts';
import type { OnCall, TeamMain } from '../../../../shared/for-you.ts';
import { iso, isoOrNull } from '../../utils/time.ts';

interface TeamMainRow {
  team_id: string;
  team_name: string;
  failing_since: Date | string | null;
  run_id: string | null;
  commit_sha: string | null;
  author_id: string | null;
  author_name: string | null;
  author_login: string | null;
  application_id: string | null;
  application_key: string | null;
  application_name: string | null;
  tier: number | null;
  failing_job: string | null;
}

/**
 * The person's teams and whether their main is broken: the runs on main since the team's last
 * passing one; if any failed, main has been broken since the first of them, and that run's
 * commit and author are named.
 */
export async function myTeams(sql: SqlExecutor, me: string): Promise<TeamMain[]> {
  const rows = await sql<TeamMainRow[]>`
    with mine as (
      select t.id, t.name from teams t join team_members m on m.team_id = t.id
      where m.user_id = ${me}::uuid),
    last_green as (
      select mine.id as team_id, (select max(r.created_at) from pipeline_runs r
        where r.team_id = mine.id and r.pull_request is null and r.ref in ('main', 'master')
          and r.state = 'passed' and r.created_at > now() - interval '14 days') as at
      from mine),
    first_red as (
      select distinct on (r.team_id) r.team_id, r.id, r.commit_sha, r.author_user_id,
        r.author_login, r.created_at
      from pipeline_runs r join last_green g on g.team_id = r.team_id
      where r.pull_request is null and r.ref in ('main', 'master') and r.state = 'failed'
        and r.created_at > coalesce(g.at, now() - interval '14 days')
      order by r.team_id, r.created_at)
    select mine.id as team_id, mine.name as team_name, f.created_at as failing_since,
      f.id as run_id, f.commit_sha, u.id as author_id, u.name as author_name, f.author_login,
      a.id as application_id, a.key as application_key, a.name as application_name, a.tier,
      (select j.name from pipeline_jobs j where j.run_id = f.id and j.state = 'failed'
        order by j.finished_at limit 1) as failing_job
    from mine
    left join first_red f on f.team_id = mine.id
    left join users u on u.id = f.author_user_id
    left join lateral (select ra.application_id from pipeline_run_applications ra
      where ra.run_id = f.id limit 1) first on true
    left join pipeline_applications a on a.id = first.application_id
    order by f.created_at is null, mine.name`;
  return rows.map((row) => ({
    team: { id: row.team_id, name: row.team_name },
    mainState: row.run_id ? 'broken' : 'healthy',
    since: isoOrNull(row.failing_since),
    culprit:
      row.run_id && row.commit_sha
        ? {
            commitSha: row.commit_sha,
            author:
              row.author_id && row.author_name
                ? { id: row.author_id, name: row.author_name, avatarUrl: null }
                : null,
            authorLogin: row.author_login,
            application:
              row.application_id && row.application_key && row.application_name
                ? {
                    id: row.application_id,
                    key: row.application_key,
                    name: row.application_name,
                    tier: (row.tier ?? 2) as Tier,
                  }
                : null,
            failingJob: row.failing_job ?? 'a job',
            runId: row.run_id,
          }
        : null,
  }));
}

/** "payments-primary" as people say it: "Payments primary". */
const scheduleLabel = (key: string) => {
  const words = key.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** The person's current on-call shift and how its team's services are doing this hour. */
export async function onCall(sql: SqlExecutor, me: string): Promise<OnCall | null> {
  const [row] = await sql<
    {
      schedule_key: string;
      ends_at: Date | string;
      team: string | null;
      deploys: number;
      failing: number;
    }[]
  >`
    select o.schedule_key, o.ends_at, t.name as team,
      (select count(*) from pipeline_deployments d join pipeline_applications a on a.id = d.application_id
        where a.owner_team_id = o.team_id and d.created_at > now() - interval '1 hour')::int as deploys,
      (select count(*) from pipeline_deployments d join pipeline_applications a on a.id = d.application_id
        where a.owner_team_id = o.team_id and d.created_at > now() - interval '1 hour'
          and d.state in ('failed', 'rolled_back'))::int as failing
    from pipeline_oncall o left join teams t on t.id = o.team_id
    where o.user_id = ${me}::uuid and o.starts_at <= now() and o.ends_at > now()
    order by o.ends_at limit 1`;
  if (!row) return null;
  const services = row.team ? `${row.team} services` : 'your services';
  const failing = row.failing === 0 ? 'none failing' : `${row.failing} failing`;
  return {
    scheduleKey: row.schedule_key,
    label: scheduleLabel(row.schedule_key),
    until: iso(row.ends_at),
    summary: `${row.deploys} ${row.deploys === 1 ? 'deploy' : 'deploys'} to ${services} in the last hour, ${failing}.`,
  };
}
