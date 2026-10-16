import type { SqlExecutor } from '@bemmoly/core';
import type { DeliverySummary } from '../../../../shared/catalog.ts';
import type { CurrentState, GlyphState } from '../../../../shared/common.ts';
import { isoOrNull } from '../../utils/time.ts';

/*
 * The delivery numbers beside each catalog row, read for one page of applications at a
 * time: the first Prod environment's release, Prod deploys per week from the daily rollups,
 * the 30-day lead time and change failure rate, and the last run on a branch that is not a
 * pull request.
 */

const WEEKS = 12;

const RUN_GLYPH: Readonly<Record<string, GlyphState>> = {
  queued: 'queued',
  running: 'running',
  waiting: 'waiting',
  passed: 'passed',
  failed: 'failed',
  cancelled: 'skipped',
  skipped: 'skipped',
};

export function glyphOfRun(state: string | null): GlyphState | null {
  return state === null ? null : (RUN_GLYPH[state] ?? null);
}

export const EMPTY_DELIVERY: DeliverySummary = {
  prodVersion: null,
  prodState: null,
  prodDeployedAt: null,
  deploysByWeek: Array.from({ length: WEEKS }, () => 0),
  leadTimeSeconds: null,
  changeFailureRate: null,
  lastRun: null,
};

interface ProdRow {
  application_id: string;
  version: string | null;
  state: string;
  deployed_at: Date | null;
}
interface WeekRow {
  application_id: string;
  week: number;
  deploys: number;
}
interface StatsRow {
  application_id: string;
  lead_time: number | null;
  deploys: number;
  failed: number;
}
interface RunRow {
  application_id: string;
  state: string;
}

export async function loadDelivery(
  sql: SqlExecutor,
  ids: readonly string[],
): Promise<Map<string, DeliverySummary>> {
  const result = new Map<string, DeliverySummary>();
  if (ids.length === 0) return result;
  const [prod, weeks, stats, runs] = await Promise.all([
    sql<ProdRow[]>`
      select distinct on (c.application_id) c.application_id, c.version, c.state, c.deployed_at
      from pipeline_current c join pipeline_environments e on e.id = c.environment_id
      where c.application_id = any(${ids}::uuid[]) and e.class = 'prod'
      order by c.application_id, e.position`,
    sql<WeekRow[]>`
      select application_id, ((current_date - day) / 7)::int as week,
        sum(prod_deploys)::int as deploys
      from pipeline_daily_rollups
      where application_id = any(${ids}::uuid[]) and day > current_date - ${WEEKS * 7}::int
      group by 1, 2`,
    sql<StatsRow[]>`
      select application_id,
        (percentile_cont(0.5) within group (order by lead_time_p50_seconds))::int as lead_time,
        sum(prod_deploys)::int as deploys,
        sum(failed_deploys + rollbacks)::int as failed
      from pipeline_daily_rollups
      where application_id = any(${ids}::uuid[]) and day > current_date - 30
      group by 1`,
    sql<RunRow[]>`
      select distinct on (ra.application_id) ra.application_id, r.state
      from pipeline_run_applications ra join pipeline_runs r on r.id = ra.run_id
      where ra.application_id = any(${ids}::uuid[]) and r.trigger <> 'pull_request'
      order by ra.application_id, ra.created_at desc`,
  ]);
  for (const id of ids)
    result.set(id, { ...EMPTY_DELIVERY, deploysByWeek: [...EMPTY_DELIVERY.deploysByWeek] });
  for (const row of prod) {
    const entry = result.get(row.application_id);
    if (!entry) continue;
    entry.prodVersion = row.version;
    entry.prodState = row.state as CurrentState;
    entry.prodDeployedAt = isoOrNull(row.deployed_at);
  }
  for (const row of weeks) {
    const entry = result.get(row.application_id);
    if (entry && row.week >= 0 && row.week < WEEKS)
      entry.deploysByWeek[WEEKS - 1 - row.week] = row.deploys;
  }
  for (const row of stats) {
    const entry = result.get(row.application_id);
    if (!entry) continue;
    entry.leadTimeSeconds = row.lead_time;
    entry.changeFailureRate = row.deploys > 0 ? Math.min(1, row.failed / row.deploys) : null;
  }
  for (const row of runs) {
    const entry = result.get(row.application_id);
    if (entry) entry.lastRun = glyphOfRun(row.state);
  }
  return result;
}
