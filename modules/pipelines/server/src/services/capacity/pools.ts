import type { SqlExecutor } from '@bemmoly/core';
import type { RunnerPool } from '../../../../shared/capacity.ts';
import type { PoolMachine } from '../../../../shared/machines.ts';
import { iso } from '../../utils/time.ts';
import { poolConfigOf } from '../machines/index.ts';

/**
 * Runner pools with how busy each is, how a Cloud Build pool starts its builds and the
 * machines it has up now: one query for the whole Capacity page, one more for the machines.
 */

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
  config: unknown;
  last_error: string | null;
  account_id: string | null;
  account_external_id: string | null;
  account_name: string | null;
}

interface MachineRow {
  id: string;
  pool_id: string;
  job_id: string;
  run_id: string;
  what: string;
  state: PoolMachine['state'];
  external_ref: string | null;
  log_url: string | null;
  created_at: Date | string;
}

function cloudBuildOf(row: PoolRow): RunnerPool['cloudBuild'] {
  const settings = poolConfigOf(row.config).cloudBuild;
  if (row.hosting !== 'cloud-build' || !settings || !row.account_id) return null;
  return {
    account: {
      id: row.account_id,
      externalId: row.account_external_id ?? '',
      name: row.account_name ?? '',
    },
    ...settings,
  };
}

export function toPool(row: PoolRow, machines: readonly PoolMachine[] = []): RunnerPool {
  // A pool whose machines Pipelines starts is busy with every machine it has up.
  const busy = Math.max(row.busy, machines.length);
  const atLimit = busy >= row.max_runners && row.max_runners > 0;
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    hosting: row.hosting,
    location: row.location,
    labels: row.labels,
    busy,
    max: row.max_runners,
    minRunners: row.min_runners,
    maxRunners: row.max_runners,
    warmRunners: row.warm_runners,
    scaling: `${row.min_runners} to ${row.max_runners}${atLimit ? ', at limit' : ''}`,
    atLimit,
    queued: row.queued,
    cloudBuild: cloudBuildOf(row),
    machines: [...machines],
    lastError: row.last_error,
  };
}

async function liveMachines(sql: SqlExecutor, poolIds: readonly string[]) {
  if (poolIds.length === 0) return new Map<string, PoolMachine[]>();
  const rows = await sql<MachineRow[]>`
    select l.id, l.pool_id, l.job_id, j.run_id, coalesce(a.key, r.title) || ' · ' || j.name as what,
      l.state, l.external_ref, l.log_url, l.created_at
    from pipeline_runner_launches l
    join pipeline_jobs j on j.id = l.job_id
    join pipeline_runs r on r.id = j.run_id
    left join pipeline_applications a on a.id = j.application_id
    where l.pool_id = any(${[...poolIds]}::uuid[]) and l.state in ('starting', 'running')
    order by l.created_at`;
  const byPool = new Map<string, PoolMachine[]>();
  for (const row of rows) {
    const list = byPool.get(row.pool_id) ?? [];
    list.push({
      id: row.id,
      jobId: row.job_id,
      runId: row.run_id,
      what: row.what,
      state: row.state,
      ref: row.external_ref,
      logUrl: row.log_url,
      startedAt: iso(row.created_at),
    });
    byPool.set(row.pool_id, list);
  }
  return byPool;
}

export async function readPools(sql: SqlExecutor, key?: string): Promise<RunnerPool[]> {
  const rows = await sql<PoolRow[]>`
    select p.id, p.key, p.name, p.hosting, p.location, p.labels, p.min_runners, p.max_runners,
      p.warm_runners, p.config, p.last_error, a.id as account_id,
      a.external_id as account_external_id, a.name as account_name,
      (select count(*)::int from pipeline_jobs j
        where j.pool_id = p.id and j.state in ('claimed', 'running')) as busy,
      (select count(*)::int from pipeline_jobs j where j.pool_id = p.id and j.state = 'ready')
        as queued
    from pipeline_runner_pools p
    left join cloud_accounts a on a.id = p.cloud_account_id
    ${key ? sql`where p.key = ${key}` : sql``}
    order by p.key`;
  const machines = await liveMachines(
    sql,
    rows.map((row) => row.id),
  );
  return rows.map((row) => toPool(row, machines.get(row.id)));
}
