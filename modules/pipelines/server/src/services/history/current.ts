import type { SqlExecutor } from '@bemmoly/core';
import type { CurrentState, EnvironmentClass, Tier } from '../../../../shared/common.ts';
import type { Current } from '../../../../shared/deployments.ts';
import { isoOrNull } from '../../utils/time.ts';

/*
 * What runs where (architecture §18), now or at any moment. Now is pipeline_current, kept in
 * step with every deployment event. At time T it is the latest event per (application,
 * environment) at or before T, replayed on top of the latest hourly snapshot before T, so a
 * rewind reads one snapshot and an hour of events rather than all of history. Events carry
 * what was current and what was moving; older events that do not are read by their state,
 * with the release current then being the latest one that succeeded there.
 */

export interface CurrentFilter {
  domain?: string | null;
  group?: string | null;
  application?: string | null;
  environment?: string | null;
}

export interface CurrentAtRow {
  application_id: string;
  application_key: string;
  application_name: string;
  tier: number;
  domain_key: string;
  group_key: string;
  environment_id: string;
  environment_key: string;
  environment_name: string;
  environment_class: string;
  release_id: string | null;
  version: string | null;
  state: string;
  moving_release_id: string | null;
  moving_version: string | null;
  traffic_percent: number;
  deployment_id: string | null;
  deployed_at: string | null;
}

const SCOPE = (sql: SqlExecutor, f: CurrentFilter) => sql`
  ${f.domain ? sql`and d.key = ${f.domain}` : sql``}
  ${f.group ? sql`and g.key = ${f.group}` : sql``}
  ${f.application ? sql`and a.key = ${f.application}` : sql``}
  ${f.environment ? sql`and e.key = ${f.environment}` : sql``}`;

export async function currentNow(sql: SqlExecutor, f: CurrentFilter): Promise<CurrentAtRow[]> {
  return sql<CurrentAtRow[]>`
    select a.id as application_id, a.key as application_key, a.name as application_name,
      a.tier, d.key as domain_key, g.key as group_key, e.id as environment_id,
      e.key as environment_key, e.name as environment_name, e.class as environment_class,
      c.release_id, c.version, c.state, c.moving_release_id, c.moving_version,
      c.traffic_percent, c.deployment_id, c.deployed_at
    from pipeline_current c
    join pipeline_applications a on a.id = c.application_id
    join pipeline_domains d on d.id = a.domain_id
    join pipeline_groups g on g.id = a.group_id
    join pipeline_environments e on e.id = c.environment_id
    where a.archived_at is null ${SCOPE(sql, f)}
    order by a.key, e.position`;
}

export async function currentAt(
  sql: SqlExecutor,
  f: CurrentFilter,
  at: Date,
): Promise<CurrentAtRow[]> {
  const t = at.toISOString();
  return sql<CurrentAtRow[]>`
    with snap as (
      select max(taken_at) as taken_at from pipeline_current_snapshots
      where taken_at <= ${t}::timestamptz
    ),
    targets as (
      select a.id as application_id, a.key as application_key, a.name as application_name,
        a.tier, d.key as domain_key, g.key as group_key, e.id as environment_id,
        e.key as environment_key, e.name as environment_name, e.class as environment_class,
        e.position
      from pipeline_applications a
      join pipeline_domains d on d.id = a.domain_id
      join pipeline_groups g on g.id = a.group_id
      cross join pipeline_environments e
      where e.archived_at is null ${SCOPE(sql, f)}
    ),
    latest as (
      select x.* from targets t2
      cross join lateral (
        select ev.application_id, ev.environment_id, ev.deployment_id, ev.release_id, ev.state,
          ev.traffic_percent, ev.data, ev.occurred_at
        from pipeline_deployment_events ev
        where ev.application_id = t2.application_id and ev.environment_id = t2.environment_id
          and ev.occurred_at <= ${t}::timestamptz
          and ev.occurred_at > coalesce((select taken_at from snap), '-infinity'::timestamptz)
        order by ev.occurred_at desc, ev.id desc limit 1
      ) x
    ),
    landed as (
      select l.application_id, l.environment_id, x.release_id, x.occurred_at
      from latest l
      cross join lateral (
        select ev.release_id, ev.occurred_at from pipeline_deployment_events ev
        where ev.application_id = l.application_id and ev.environment_id = l.environment_id
          and ev.state = 'succeeded' and ev.occurred_at <= ${t}::timestamptz
        order by ev.occurred_at desc, ev.id desc limit 1
      ) x
    ),
    base as (
      select s.* from pipeline_current_snapshots s, snap where s.taken_at = snap.taken_at
    )
    select t.application_id, t.application_key, t.application_name, t.tier, t.domain_key,
      t.group_key, t.environment_id, t.environment_key, t.environment_name, t.environment_class,
      case when l.deployment_id is null then b.release_id
        else coalesce((l.data #>> '{current,releaseId}')::uuid, ld.release_id) end as release_id,
      case when l.deployment_id is null then b.version
        else coalesce(l.data #>> '{current,version}', lr.version) end as version,
      case when l.deployment_id is null then coalesce(b.state, 'idle')
        when l.state in ('pending', 'deploying') then 'deploying'
        when l.state in ('succeeded', 'cancelled') then 'idle'
        else l.state end as state,
      case when l.deployment_id is null then b.moving_release_id
        when l.state in ('pending', 'deploying', 'canary', 'waiting') then l.release_id end
        as moving_release_id,
      case when l.deployment_id is null then b.moving_version
        when l.state in ('pending', 'deploying', 'canary', 'waiting') then mr.version end
        as moving_version,
      coalesce(l.traffic_percent, b.traffic_percent, 0)::int as traffic_percent,
      coalesce(l.deployment_id, b.deployment_id) as deployment_id,
      case when l.deployment_id is null then b.deployed_at else ld.occurred_at end as deployed_at
    from targets t
    left join latest l on l.application_id = t.application_id and l.environment_id = t.environment_id
    left join landed ld on ld.application_id = t.application_id and ld.environment_id = t.environment_id
    left join pipeline_releases lr on lr.id = ld.release_id
    left join pipeline_releases mr on mr.id = l.release_id
    left join base b on b.application_id = t.application_id and b.environment_id = t.environment_id
    where l.deployment_id is not null or b.application_id is not null
    order by t.application_key, t.position`;
}

export function toCurrent(row: CurrentAtRow): Current {
  return {
    application: {
      id: row.application_id,
      key: row.application_key,
      name: row.application_name,
      tier: row.tier as Tier,
    },
    environment: {
      id: row.environment_id,
      key: row.environment_key,
      name: row.environment_name,
      class: row.environment_class as EnvironmentClass,
    },
    release: row.release_id && row.version ? { id: row.release_id, version: row.version } : null,
    state: row.state as CurrentState,
    moving:
      row.moving_release_id && row.moving_version
        ? { id: row.moving_release_id, version: row.moving_version }
        : null,
    trafficPercent: row.traffic_percent,
    deploymentId: row.deployment_id,
    deployedAt: isoOrNull(row.deployed_at),
  };
}
