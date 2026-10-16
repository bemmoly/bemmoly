import type { SqlExecutor } from '@bemmoly/core';
import type {
  BuildCellRecord,
  BuildDotRecord,
  MapCellRecord,
  MapDotRecord,
  MapRowRecord,
} from '../../models/delivery.ts';

/*
 * The map's reads. A row is a domain at the organisation, a group inside a domain and an
 * application inside a group; every query groups applications by that row and filters them
 * the same way, so counts, dots and builds always agree.
 */

export type MapLevel = 'organisation' | 'domain' | 'group';

export interface MapFilter {
  level: MapLevel;
  domainId: string | null;
  groupId: string | null;
  team: string | null;
  tier: number | null;
  /** Rewound to this moment; null is live. */
  at: Date | null;
}

const ROW: Record<MapLevel, string> = {
  organisation: 'a.domain_id',
  domain: 'a.group_id',
  group: 'a.id',
};

/** Which applications count, as conditions on the alias `a`. */
export function applicationFilter(sql: SqlExecutor, filter: MapFilter) {
  return sql`
    ${filter.groupId ? sql`and a.group_id = ${filter.groupId}::uuid` : sql``}
    ${!filter.groupId && filter.domainId ? sql`and a.domain_id = ${filter.domainId}::uuid` : sql``}
    ${filter.team ? sql`and a.owner_team_id = ${filter.team}::uuid` : sql``}
    ${filter.tier !== null ? sql`and a.tier = ${filter.tier}` : sql``}`;
}

export function mapRows(sql: SqlExecutor, filter: MapFilter): Promise<MapRowRecord[]> {
  const where = applicationFilter(sql, filter);
  if (filter.level === 'organisation')
    return sql<MapRowRecord[]>`
      select d.id, d.key, d.name, d.color, count(a.id)::int as count
      from pipeline_domains d
      left join pipeline_applications a on a.domain_id = d.id ${where}
      group by d.id order by count(a.id) desc, d.name`;
  if (filter.level === 'domain')
    return sql<MapRowRecord[]>`
      select g.id, g.key, g.name, null::text as color, count(a.id)::int as count
      from pipeline_groups g
      left join pipeline_applications a on a.group_id = g.id ${where}
      where g.domain_id = ${filter.domainId}::uuid
      group by g.id order by count(a.id) desc, g.name`;
  return sql<MapRowRecord[]>`
    select a.id, a.key, a.name, null::text as color, 1 as count
    from pipeline_applications a
    where true ${where}
    order by a.name`;
}

/**
 * Each application's state in each environment: from pipeline_current while live, or the
 * latest deployment event at or before the moment when rewound (one index probe per target).
 */
function targets(sql: SqlExecutor, filter: MapFilter) {
  const row = sql.unsafe(ROW[filter.level]);
  const where = applicationFilter(sql, filter);
  if (!filter.at)
    return sql`
      select ${row} as row_id, c.environment_id, c.state, c.traffic_percent, c.updated_at,
        c.version is not null as placed, c.id as dot_id, a.key as app_key,
        coalesce(c.moving_version, c.version) as version
      from pipeline_current c
      join pipeline_applications a on a.id = c.application_id
      where true ${where}`;
  return sql`
    select ${row} as row_id, c.environment_id,
      case e.state when 'succeeded' then 'idle' when 'cancelled' then 'idle'
        when 'pending' then 'waiting' else e.state end as state,
      e.traffic_percent, e.occurred_at as updated_at, true as placed, e.id as dot_id,
      a.key as app_key, r.version
    from pipeline_current c
    join pipeline_applications a on a.id = c.application_id
    cross join lateral (
      select ev.id, ev.state, ev.traffic_percent, ev.release_id, ev.occurred_at
      from pipeline_deployment_events ev
      where ev.application_id = c.application_id and ev.environment_id = c.environment_id
        and ev.occurred_at <= ${filter.at.toISOString()}::timestamptz
      order by ev.occurred_at desc limit 1) e
    left join pipeline_releases r on r.id = e.release_id
    where true ${where}`;
}

/** Counts per row and environment, with up to twelve moving releases as dots. */
export async function mapCells(
  sql: SqlExecutor,
  filter: MapFilter,
): Promise<{ cells: MapCellRecord[]; dots: MapDotRecord[] }> {
  const rows = await sql<(MapCellRecord & { dots: MapDotRecord[] })[]>`
    with t as (${targets(sql, filter)}),
    ranked as (
      select t.*, row_number() over (
        partition by row_id, environment_id,
          state in ('deploying', 'canary', 'waiting', 'failed')
        order by updated_at desc) as n
      from t)
    select row_id, environment_id,
      count(*) filter (where placed)::int as total,
      count(*) filter (where state = 'deploying')::int as moving,
      count(*) filter (where state = 'failed')::int as failed,
      count(*) filter (where state = 'waiting')::int as waiting,
      count(*) filter (where state = 'canary')::int as canary,
      count(*) filter (where state = 'rolled_back')::int as rolled_back,
      coalesce(jsonb_agg(jsonb_build_object(
        'row_id', row_id, 'environment_id', environment_id, 'id', dot_id,
        'application', app_key, 'version', version, 'state', state,
        'progress', case state when 'canary' then traffic_percent / 100.0
          when 'waiting' then 0.06 when 'failed' then 0.5
          else least(0.9, greatest(0.1, extract(epoch from (
            ${filter.at ? filter.at.toISOString() : new Date().toISOString()}::timestamptz
            - updated_at)) / 180.0)) end))
        filter (where state in ('deploying', 'canary', 'waiting', 'failed') and n <= 12),
        '[]'::jsonb) as dots
    from ranked
    group by row_id, environment_id`;
  return { cells: rows, dots: rows.flatMap((row) => row.dots) };
}

/** Runs building for each row: in progress now, or at the rewound moment. */
export async function buildCells(
  sql: SqlExecutor,
  filter: MapFilter,
): Promise<{ cells: BuildCellRecord[]; dots: BuildDotRecord[] }> {
  const row = sql.unsafe(ROW[filter.level]);
  const at = (filter.at ?? new Date()).toISOString();
  const active = filter.at
    ? sql`r.created_at <= ${at}::timestamptz
        and r.created_at > ${at}::timestamptz - interval '1 day'
        and (r.finished_at is null or r.finished_at > ${at}::timestamptz)`
    : sql`r.state in ('queued', 'running', 'waiting')`;
  const rows = await sql<(BuildCellRecord & { dots: BuildDotRecord[] })[]>`
    with t as (
      select ${row} as row_id, ra.id, a.key as app_key, left(r.commit_sha, 7) as version,
        -- How far along: the share of the run's jobs that have finished.
        least(0.95, greatest(0.05, (select count(*) filter (where j.finished_at is not null
            and j.finished_at <= ${at}::timestamptz)::float / greatest(count(*), 1)
          from pipeline_jobs j where j.run_id = r.id))) as progress,
        row_number() over (partition by ${row} order by r.created_at desc) as n,
        r.id as run_id
      from pipeline_runs r
      join pipeline_run_applications ra on ra.run_id = r.id
      join pipeline_applications a on a.id = ra.application_id
      where ${active} ${applicationFilter(sql, filter)})
    select row_id, count(distinct run_id)::int as running,
      coalesce(jsonb_agg(jsonb_build_object('row_id', row_id, 'id', id,
        'application', app_key, 'version', version, 'progress', progress))
        filter (where n <= 12), '[]'::jsonb) as dots
    from t group by row_id`;
  return { cells: rows, dots: rows.flatMap((item) => item.dots) };
}
