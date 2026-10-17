import type { SqlExecutor } from '@bemmoly/core';
import type { InsightsMeasure, InsightsMeasures } from '../../../../shared/insights.ts';

/*
 * The four delivery measures over a window of days and the window before it, week by week.
 * Deploys, failures and lead time come from the daily rollups; time to restore from the Prod
 * roll backs themselves, since a rollup cannot hold a median across days.
 */

export interface Window {
  /** Days in the range that have history. */
  days: number;
  previousDays: number;
  /** The first day in the range, as an ISO date. */
  from: string;
  /** The first day of the range before it. */
  previousFrom: string;
}

/** A condition on an application id column for the scope being measured. */
export type ScopeFilter = (column: string) => ReturnType<SqlExecutor>;

interface TotalsRow {
  current: boolean;
  deploys: number;
  failed: number;
  lead_time: number | null;
}

interface WeekRow {
  week: Date;
  deploys: number;
  failed: number;
  lead_time: number | null;
  days: number;
}

interface RestoreRow {
  current: boolean;
  week: Date | null;
  restore: number | null;
}

const rate = (failed: number, deploys: number) => (deploys > 0 ? failed / deploys : null);

function measure(
  value: number | null,
  previous: number | null,
  weeks: InsightsMeasure['weeks'],
): InsightsMeasure {
  return { value, previous, weeks };
}

export async function readMeasures(
  sql: SqlExecutor,
  window: Window,
  inScope: ScopeFilter,
): Promise<InsightsMeasures> {
  const [totals, weeks, restores] = await Promise.all([
    sql<TotalsRow[]>`
      select day >= ${window.from}::date as current,
        coalesce(sum(prod_deploys), 0)::int as deploys,
        coalesce(sum(failed_deploys + rollbacks), 0)::int as failed,
        (percentile_cont(0.5) within group (order by lead_time_p50_seconds))::int as lead_time
      from pipeline_daily_rollups
      where day >= ${window.previousFrom}::date and day <= current_date
        and ${inScope('application_id')}
      group by 1`,
    sql<WeekRow[]>`
      select date_trunc('week', day)::date as week,
        coalesce(sum(prod_deploys), 0)::int as deploys,
        coalesce(sum(failed_deploys + rollbacks), 0)::int as failed,
        (percentile_cont(0.5) within group (order by lead_time_p50_seconds))::int as lead_time,
        count(distinct day)::int as days
      from pipeline_daily_rollups
      where day >= ${window.from}::date and day <= current_date
        and ${inScope('application_id')}
      group by 1 order by 1`,
    sql<RestoreRow[]>`
      with restores as (
        select r.finished_at,
          extract(epoch from r.finished_at - coalesce(bad.started_at, bad.created_at)) as seconds
        from pipeline_deployments r
        join pipeline_deployments bad on bad.id = r.rollback_of_id
        join pipeline_environments e on e.id = r.environment_id and e.class = 'prod'
        where r.kind = 'rollback' and r.state = 'succeeded'
          and r.finished_at >= ${window.previousFrom}::date
          and ${inScope('r.application_id')})
      select finished_at >= ${window.from}::date as current, null::date as week,
        (percentile_cont(0.5) within group (order by seconds))::int as restore
      from restores group by 1
      union all
      select true, date_trunc('week', finished_at)::date,
        (percentile_cont(0.5) within group (order by seconds))::int
      from restores where finished_at >= ${window.from}::date group by 2`,
  ]);
  const now = totals.find((row) => row.current);
  const before = totals.find((row) => !row.current);
  const overall = restores.filter((row) => row.week === null);
  const restoreWeeks = new Map(
    restores
      .filter((row) => row.week !== null && row.current)
      .map((row) => [new Date(row.week ?? 0).toISOString(), row.restore]),
  );
  const series = weeks.map((row) => ({ ...row, start: new Date(row.week).toISOString() }));
  const point = (pick: (row: (typeof series)[number]) => number | null) =>
    series.map((row) => ({ start: row.start, value: pick(row) }));
  return {
    leadTime: measure(
      now?.lead_time ?? null,
      before?.lead_time ?? null,
      point((row) => row.lead_time),
    ),
    deployFrequency: measure(
      now ? now.deploys / window.days : null,
      before ? before.deploys / window.previousDays : null,
      point((row) => (row.days > 0 ? row.deploys / row.days : null)),
    ),
    changeFailureRate: measure(
      now ? rate(now.failed, now.deploys) : null,
      before ? rate(before.failed, before.deploys) : null,
      point((row) => rate(row.failed, row.deploys)),
    ),
    timeToRestore: measure(
      overall.find((row) => row.current)?.restore ?? null,
      overall.find((row) => !row.current)?.restore ?? null,
      series.map((row) => ({ start: row.start, value: restoreWeeks.get(row.start) ?? null })),
    ),
  };
}
