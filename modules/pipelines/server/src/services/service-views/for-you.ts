import type { SqlExecutor } from '@bemmoly/core';
import type { ChangeRequestStatus } from '../../../../shared/change-requests.ts';
import type { CurrentState, Runtime } from '../../../../shared/common.ts';
import type { ForYouNeed, ForYouSummary } from '../../../../shared/service-views.ts';
import { iso } from '../../utils/time.ts';
import { changeCounts, pathEnvironments, toEnvironment } from './path.ts';

const ONGOING: readonly ChangeRequestStatus[] = ['draft', 'waiting', 'approved', 'deploying'];

async function stats(sql: SqlExecutor, last: string | null) {
  const [deploys] = await sql<{ this_week: number; last_week: number }[]>`
    select
      count(*) filter (where finished_at >= now() - interval '7 days')::int as this_week,
      count(*) filter (where finished_at < now() - interval '7 days')::int as last_week
    from pipeline_deployments
    where kind = 'deploy' and state = 'succeeded' and finished_at >= now() - interval '14 days'`;
  const [changes] = await sql<
    { total: number; approved: number; rejected: number; median: number | null }[]
  >`
    select count(*)::int as total,
      count(*) filter (where status in ('approved', 'deploying', 'deployed'))::int as approved,
      count(*) filter (where status = 'rejected')::int as rejected,
      (percentile_cont(0.5) within group (order by extract(epoch from decided_at - sent_at))
        filter (where decided_at is not null and sent_at is not null
          and status in ('approved', 'deploying', 'deployed')))::int as median
    from pipeline_change_requests
    where environment_id = ${last}::uuid and created_at >= now() - interval '30 days'`;
  const failing = await sql<{ service: string; environment: string }[]>`
    select a.key as service, e.name as environment
    from pipeline_current c
    join pipeline_applications a on a.id = c.application_id and a.archived_at is null
    join pipeline_environments e on e.id = c.environment_id and e.archived_at is null
    where c.state = 'failed'
    order by c.updated_at desc`;
  return {
    deploysThisWeek: deploys?.this_week ?? 0,
    deploysLastWeek: deploys?.last_week ?? 0,
    changesToLast: {
      total: changes?.total ?? 0,
      approved: changes?.approved ?? 0,
      rejected: changes?.rejected ?? 0,
    },
    approvalMedianSeconds: changes?.median ?? null,
    failingNow: new Set(failing.map((row) => row.service)).size,
    firstFailing: failing[0] ?? null,
  };
}

/** The person's runs that failed and were not passed since on the same branch. */
async function needs(sql: SqlExecutor, me: string): Promise<ForYouNeed[]> {
  const failed = await sql<
    {
      id: string;
      number: string;
      title: string;
      commit_sha: string;
      created_at: Date;
      service: string | null;
    }[]
  >`
    select r.id, r.number, r.title, r.commit_sha, r.created_at,
      (select a.key from pipeline_run_applications ra
        join pipeline_applications a on a.id = ra.application_id
        where ra.run_id = r.id order by a.key limit 1) as service
    from pipeline_runs r
    where r.author_user_id = ${me}::uuid and r.state = 'failed'
      and r.created_at >= now() - interval '7 days'
      and not exists (
        select 1 from pipeline_runs later
        where later.repository_id is not distinct from r.repository_id and later.ref = r.ref
          and later.created_at > r.created_at and later.state = 'passed')
    order by r.created_at desc limit 5`;
  const changes = await sql<
    {
      number: string;
      title: string;
      status: string;
      environment: string;
      change_approvals: number;
      change_needed: number;
      services: { key: string; version: string }[] | null;
    }[]
  >`
    select cr.number, cr.title, cr.status, e.name as environment, ${changeCounts(sql)},
      (select json_agg(json_build_object('key', a.key, 'version', rel.version) order by a.key)
        from pipeline_change_request_items i
        join pipeline_applications a on a.id = i.application_id
        join pipeline_releases rel on rel.id = i.release_id
        where i.change_request_id = cr.id) as services
    from pipeline_change_requests cr
    join pipeline_environments e on e.id = cr.environment_id
    where cr.requested_by = ${me}::uuid and cr.status = any(${[...ONGOING]}::text[])
    order by cr.updated_at desc limit 5`;
  return [
    ...failed.map((row): ForYouNeed => ({
      kind: 'failed_run',
      run: { id: row.id, number: Number(row.number), title: row.title },
      service: row.service,
      commitSha: row.commit_sha,
      at: iso(row.created_at),
    })),
    ...changes.map((row): ForYouNeed => ({
      kind: 'change_request',
      number: `CHG-${row.number}`,
      title: row.title,
      status: row.status as ChangeRequestStatus,
      environment: row.environment,
      approvals: row.change_approvals,
      needed: row.change_needed,
      services: row.services ?? [],
    })),
  ];
}

/** Services the person's teams own; without a team, the ones they ran in the last 30 days. */
async function yours(sql: SqlExecutor, me: string, last: string | null) {
  const rows = await sql<
    {
      id: string;
      key: string;
      name: string;
      runtime: string;
      domain: string;
      version: string | null;
    }[]
  >`
    with owned as (
      select a.id from pipeline_applications a
      where a.archived_at is null and a.owner_team_id in (
        select team_id from team_members where user_id = ${me}::uuid)),
    ran as (
      select distinct ra.application_id as id from pipeline_runs r
      join pipeline_run_applications ra on ra.run_id = r.id
      where r.author_user_id = ${me}::uuid and r.created_at >= now() - interval '30 days'),
    picked as (
      select id from owned union all
      select id from ran where not exists (select 1 from owned))
    select a.id, a.key, a.name, a.runtime, d.name as domain,
      (select c.version from pipeline_current c
        where c.application_id = a.id and c.environment_id = ${last}::uuid) as version
    from pipeline_applications a join pipeline_domains d on d.id = a.domain_id
    where a.id in (select id from picked)
    order by lower(a.key) limit 12`;
  const ids = rows.map((row) => row.id);
  const states = ids.length
    ? await sql<{ application_id: string; key: string; state: string }[]>`
        select c.application_id, e.key, c.state from pipeline_current c
        join pipeline_environments e on e.id = c.environment_id
        where c.application_id = any(${ids}::uuid[])`
    : [];
  return { rows, states };
}

/** For you for a developer or an admin: stats, what needs them and their services. */
export async function forYouSummary(sql: SqlExecutor, me: string): Promise<ForYouSummary> {
  const environments = await pathEnvironments(sql);
  const last = environments.at(-1) ?? null;
  const [numbers, needsYou, mine] = await Promise.all([
    stats(sql, last?.id ?? null),
    needs(sql, me),
    yours(sql, me, last?.id ?? null),
  ]);
  return {
    lastEnvironment: last ? { key: last.key, name: last.name } : null,
    environments: environments.map(toEnvironment),
    stats: numbers,
    needsYou: needsYou.slice(0, 10),
    yourServices: mine.rows.map((row) => ({
      key: row.key,
      name: row.name,
      kind: row.runtime as Runtime,
      domain: row.domain,
      lastVersion: row.version,
      states: environments.map((environment) => ({
        environment: environment.key,
        state:
          (mine.states.find(
            (state) => state.application_id === row.id && state.key === environment.key,
          )?.state as CurrentState | undefined) ?? null,
      })),
    })),
  };
}
