import type { SqlExecutor } from '@bemmoly/core';
import type { RunnerPool } from '../../../../shared/capacity.ts';

/** Runner pools with how busy each is: one query for the whole Capacity page. */

interface PoolRow {
  id: string;
  key: string;
  name: string;
  hosting: RunnerPool['hosting'];
  location: string | null;
  labels: string[];
  min_runners: number;
  max_runners: number;
  warm_runners: number;
  busy: number;
  queued: number;
}

export function toPool(row: PoolRow): RunnerPool {
  const atLimit = row.busy >= row.max_runners && row.max_runners > 0;
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    hosting: row.hosting,
    location: row.location,
    labels: row.labels,
    busy: row.busy,
    max: row.max_runners,
    minRunners: row.min_runners,
    maxRunners: row.max_runners,
    warmRunners: row.warm_runners,
    scaling: `${row.min_runners} to ${row.max_runners}${atLimit ? ', at limit' : ''}`,
    atLimit,
    queued: row.queued,
  };
}

export async function readPools(sql: SqlExecutor, key?: string): Promise<RunnerPool[]> {
  const rows = await sql<PoolRow[]>`
    select p.id, p.key, p.name, p.hosting, p.location, p.labels, p.min_runners, p.max_runners,
      p.warm_runners,
      (select count(*)::int from pipeline_jobs j
        where j.pool_id = p.id and j.state in ('claimed', 'running')) as busy,
      (select count(*)::int from pipeline_jobs j where j.pool_id = p.id and j.state = 'ready')
        as queued
    from pipeline_runner_pools p
    ${key ? sql`where p.key = ${key}` : sql``}
    order by p.key`;
  return rows.map(toPool);
}
