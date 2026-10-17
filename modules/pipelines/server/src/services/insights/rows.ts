import type { SqlExecutor } from '@bemmoly/core';
import type { InsightsBreakdown, InsightsRow } from '../../../../shared/insights.ts';
import type { DomainColor } from '../../../../shared/catalog.ts';
import type { ScopeFilter, Window } from './measures.ts';

/*
 * The rows under the measures: the organisation's domains, a domain's groups, or a group's
 * owning teams; or, when asked by team, every owning team in the scope. Each row carries the
 * same four measures for its own applications over the range.
 */

export type RowLevel = 'domain' | 'group' | 'team';

interface Row {
  key: string;
  name: string;
  color: string | null;
  applications: number;
  deploys: number;
  failed: number;
  lead_time: number | null;
  restore: number | null;
}

/** Which column of pipeline_applications a level groups by, and where its name comes from. */
const LEVELS: Record<RowLevel, { column: string; names: string; key: string; color: string }> = {
  domain: { column: 'domain_id', names: 'pipeline_domains', key: 'n.key', color: 'n.color' },
  group: { column: 'group_id', names: 'pipeline_groups', key: 'n.key', color: 'null' },
  team: { column: 'owner_team_id', names: 'teams', key: 'n.id::text', color: 'null' },
};

/** The organisation shows domains, a domain its groups, a group the teams that own in it. */
export function levelFor(
  by: InsightsBreakdown,
  scope: { domain: unknown; group: unknown },
): RowLevel {
  if (by === 'team' || scope.group) return 'team';
  return scope.domain ? 'group' : 'domain';
}

export async function readRows(
  sql: SqlExecutor,
  window: Window,
  level: RowLevel,
  inScope: ScopeFilter,
): Promise<InsightsRow[]> {
  const { column, names, key, color } = LEVELS[level];
  const rows = await sql<Row[]>`
    with apps as (
      select id, ${sql.unsafe(column)} as part from pipeline_applications
      where archived_at is null and ${sql.unsafe(column)} is not null and ${inScope('id')}),
    rollups as (
      select a.part, coalesce(sum(r.prod_deploys), 0)::int as deploys,
        coalesce(sum(r.failed_deploys + r.rollbacks), 0)::int as failed,
        (percentile_cont(0.5) within group (order by r.lead_time_p50_seconds))::int as lead_time
      from pipeline_daily_rollups r join apps a on a.id = r.application_id
      where r.day >= ${window.from}::date and r.day <= current_date
      group by a.part),
    restores as (
      select a.part, (percentile_cont(0.5) within group (order by
          extract(epoch from r.finished_at - coalesce(bad.started_at, bad.created_at))))::int
          as restore
      from pipeline_deployments r
      join apps a on a.id = r.application_id
      join pipeline_deployments bad on bad.id = r.rollback_of_id
      join pipeline_environments e on e.id = r.environment_id and e.class = 'prod'
      where r.kind = 'rollback' and r.state = 'succeeded'
        and r.finished_at >= ${window.from}::date
      group by a.part),
    counts as (select part, count(*)::int as applications from apps group by part)
    select ${sql.unsafe(key)} as key, n.name, ${sql.unsafe(color)} as color, c.applications,
      coalesce(ro.deploys, 0) as deploys, coalesce(ro.failed, 0) as failed,
      ro.lead_time, rs.restore
    from counts c
    join ${sql.unsafe(names)} n on n.id = c.part
    left join rollups ro on ro.part = c.part
    left join restores rs on rs.part = c.part
    order by coalesce(ro.deploys, 0) desc, n.name
    limit 200`;
  return rows.map((row) => ({
    kind: level,
    key: row.key,
    name: row.name,
    color: (row.color as DomainColor | null) ?? null,
    applications: row.applications,
    prodDeploys: row.deploys,
    leadTimeSeconds: row.lead_time,
    deploysPerDay: row.deploys / window.days,
    changeFailureRate: row.deploys > 0 ? row.failed / row.deploys : null,
    timeToRestoreSeconds: row.restore,
  }));
}
