import type { SqlExecutor } from '@bemmoly/core';
import type { DomainColor } from '../../../../shared/catalog.ts';
import type { CurrentState, RunState, Runtime } from '../../../../shared/common.ts';
import type {
  ListServicesQuery,
  ServiceRow,
  ServiceRunning,
  ServicesResponse,
} from '../../../../shared/service-views.ts';
import type { RunningRecord, ServiceRecord } from '../../models/service-views.ts';
import { escapeLike, iso, isoOrNull } from '../../utils/time.ts';
import {
  changeCounts,
  changeRef,
  OPEN_CHANGE_STATUSES,
  pathEnvironments,
  toEnvironment,
} from './path.ts';

/** The table draws at most this many; the filters narrow past it. */
const CAP = 500;

function where(sql: SqlExecutor, query: ListServicesQuery, me: string | null) {
  const parts = [sql`a.archived_at is null`];
  if (query.q) {
    const pattern = `%${escapeLike(query.q.toLowerCase())}%`;
    parts.push(sql`and (lower(a.key || ' ' || a.name || ' ' || a.path) like ${pattern}
      or lower(coalesce(r.full_name, '')) like ${pattern})`);
  }
  if (query.domain) parts.push(sql`and d.key = ${query.domain}`);
  if (query.team) parts.push(sql`and a.owner_team_id = ${query.team}::uuid`);
  if (query.mine)
    parts.push(sql`and a.owner_team_id in (
      select team_id from team_members where user_id = ${me ?? '00000000-0000-0000-0000-000000000000'}::uuid)`);
  return parts.reduce((all, part) => sql`${all} ${part}`);
}

/** What runs where for these services, with the open change request moving each target. */
export async function runningFor(
  sql: SqlExecutor,
  ids: readonly string[],
): Promise<RunningRecord[]> {
  if (ids.length === 0) return [];
  return sql<RunningRecord[]>`
    select c.application_id, e.key as environment_key, c.release_id, c.version,
      rel.commit_sha, run.title as message, c.state, c.moving_version, c.traffic_percent,
      c.deployed_at, u.name as deployed_by,
      chg.number as change_number, chg.status as change_status,
      chg.change_approvals, chg.change_needed
    from pipeline_current c
    join pipeline_environments e on e.id = c.environment_id and e.archived_at is null
    left join pipeline_releases rel on rel.id = c.release_id
    left join pipeline_runs run on run.id = rel.run_id
    left join pipeline_deployments dep on dep.id = c.deployment_id
    left join users u on u.id = dep.started_by
    left join lateral (
      select cr.number, cr.status, ${changeCounts(sql)}
      from pipeline_change_request_items i
      join pipeline_change_requests cr on cr.id = i.change_request_id
      where i.application_id = c.application_id and cr.environment_id = c.environment_id
        and cr.status = any(${[...OPEN_CHANGE_STATUSES]}::text[])
      order by cr.created_at desc limit 1) chg on true
    where c.application_id = any(${[...ids]}::uuid[])`;
}

export function toRunning(row: RunningRecord): ServiceRunning {
  return {
    environment: row.environment_key,
    version: row.version,
    releaseId: row.release_id,
    commitSha: row.commit_sha,
    message: row.message,
    state: row.state as CurrentState,
    movingVersion: row.moving_version,
    trafficPercent: row.traffic_percent ?? 0,
    deployedAt: isoOrNull(row.deployed_at),
    deployedBy: row.deployed_by,
    pending: changeRef(row),
  };
}

function toRow(row: ServiceRecord, running: readonly RunningRecord[]): ServiceRow {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    kind: row.runtime as Runtime,
    path: row.path,
    repository: row.repository,
    domain: {
      key: row.domain_key,
      name: row.domain_name,
      color: row.domain_color as DomainColor,
    },
    team: row.team_id && row.team_name ? { id: row.team_id, name: row.team_name } : null,
    running: running.filter((item) => item.application_id === row.id).map(toRunning),
    lastRun:
      row.run_id && row.run_number !== null && row.run_state && row.run_created_at
        ? {
            id: row.run_id,
            number: Number(row.run_number),
            state: row.run_state as RunState,
            createdAt: iso(row.run_created_at),
          }
        : null,
  };
}

/** Every service by domain, the version in each environment and its last run. */
export async function listServices(
  sql: SqlExecutor,
  query: ListServicesQuery,
  me: string | null,
): Promise<ServicesResponse> {
  const filter = where(sql, query, me);
  const [environments, rows, [count], domains, teams] = await Promise.all([
    pathEnvironments(sql),
    sql<ServiceRecord[]>`
      select a.id, a.key, a.name, a.runtime, a.path, r.full_name as repository,
        d.key as domain_key, d.name as domain_name, d.color as domain_color,
        t.id as team_id, t.name as team_name,
        lr.id as run_id, lr.number as run_number, lr.state as run_state,
        lr.created_at as run_created_at
      from pipeline_applications a
      join pipeline_domains d on d.id = a.domain_id
      left join teams t on t.id = a.owner_team_id
      left join pipeline_repositories r on r.id = a.repository_id
      left join lateral (
        select run.id, run.number, run.state, run.created_at
        from pipeline_run_applications ra join pipeline_runs run on run.id = ra.run_id
        where ra.application_id = a.id
        order by ra.created_at desc limit 1) lr on true
      where ${filter}
      order by d.position, lower(d.name), lower(a.key), a.id
      limit ${CAP}`,
    sql<{ total: number }[]>`
      select count(*)::int as total from pipeline_applications a
      join pipeline_domains d on d.id = a.domain_id
      left join pipeline_repositories r on r.id = a.repository_id
      where ${filter}`,
    sql<{ key: string; name: string; color: string; count: number }[]>`
      select d.key, d.name, d.color,
        (select count(*) from pipeline_applications a
          where a.domain_id = d.id and a.archived_at is null)::int as count
      from pipeline_domains d order by d.position, lower(d.name)`,
    sql<{ id: string; name: string }[]>`
      select distinct t.id, t.name from teams t
      join pipeline_applications a on a.owner_team_id = t.id and a.archived_at is null
      order by t.name`,
  ]);
  const running = await runningFor(
    sql,
    rows.map((row) => row.id),
  );
  return {
    environments: environments.map(toEnvironment),
    domains: domains.map((domain) => ({ ...domain, color: domain.color as DomainColor })),
    teams,
    items: rows.map((row) => toRow(row, running)),
    total: count?.total ?? 0,
  };
}
