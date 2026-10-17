import type { SqlExecutor } from '@bemmoly/core';
import type { WaitReason } from '../../../../shared/runs.ts';
import { HEARTBEAT_SECONDS } from '../../../../shared/runner.ts';
import type { JobRow } from './present.ts';

/*
 * Why a job is not running yet, in words a person can act on: "Waits for Build", "No runner
 * in linux-x64 is online", "3rd in Payments' queue in linux-x64, about 40 s". Read only for
 * the jobs that wait, so a finished run costs nothing here.
 */

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

/** "Payments' queue", "Search's queue". */
export function possessive(name: string): string {
  return name.endsWith('s') ? `${name}'` : `${name}'s`;
}

function waitsFor(row: JobRow, all: readonly JobRow[]): WaitReason {
  const open = all.filter((job) => row.needs.includes(job.key) && job.state !== 'passed');
  const names = open.slice(0, 3).map((job) => job.name);
  const more = open.length > 3 ? ` and ${open.length - 3} more` : '';
  return {
    kind: 'dependency',
    text: names.length > 0 ? `Waits for ${names.join(', ')}${more}` : 'Waits for the jobs it needs',
  };
}

interface QueueFacts {
  position: number;
  online: number;
  blocked_key: string | null;
  team_name: string | null;
  avg_seconds: number | null;
}

async function queueFacts(sql: SqlExecutor, row: JobRow): Promise<QueueFacts | undefined> {
  const [facts] = await sql<QueueFacts[]>`
    select
      (select count(*)::int + 1 from pipeline_jobs o
        where o.state = 'ready' and o.pool_id = ${row.pool_id}::uuid
          and (o.priority < ${row.priority}
            or (o.priority = ${row.priority} and (o.ready_at, o.id) < (j.ready_at, j.id))))
        as position,
      (select count(*)::int from pipeline_runners r
        where r.pool_id = ${row.pool_id}::uuid and r.state in ('idle', 'busy')
          and r.last_heartbeat_at > now() - make_interval(secs => ${HEARTBEAT_SECONDS * 3}))
        as online,
      case when j.concurrency_key is not null and (select count(*) from pipeline_jobs c
          where c.concurrency_key = j.concurrency_key and c.state in ('claimed', 'running'))
          >= j.concurrency_limit then j.concurrency_key end as blocked_key,
      (select name from teams where id = j.team_id) as team_name,
      (select avg(extract(epoch from (f.finished_at - f.started_at)))::int from (
        select started_at, finished_at from pipeline_jobs
        where pool_id = ${row.pool_id}::uuid and state in ('passed', 'failed')
          and started_at is not null and finished_at > now() - interval '1 day'
        order by finished_at desc limit 50) f) as avg_seconds
    from pipeline_jobs j where j.id = ${row.id}`;
  return facts;
}

async function inQueue(sql: SqlExecutor, row: JobRow): Promise<WaitReason> {
  const pool = row.pool_key ?? 'its pool';
  if (!row.pool_id) return { kind: 'runner', text: 'No runner pool is set up yet' };
  const facts = await queueFacts(sql, row);
  if (!facts) return { kind: 'runner', text: `Waiting for a runner in ${pool}` };
  if (facts.blocked_key) {
    return { kind: 'concurrency', text: `Waits for ${facts.blocked_key} to finish` };
  }
  if (facts.online === 0) {
    return {
      kind: 'runner',
      text: `No runner in ${pool} is online`,
      position: facts.position,
    };
  }
  const eta =
    facts.avg_seconds !== null
      ? Math.round(Math.ceil(facts.position / Math.max(1, facts.online)) * facts.avg_seconds)
      : undefined;
  const queue = facts.team_name
    ? `${possessive(facts.team_name)} queue in ${pool}`
    : `the ${pool} queue`;
  return {
    kind: facts.position > facts.online ? 'fair_share' : 'runner',
    text: `${ordinal(facts.position)} in ${queue}`,
    position: facts.position,
    ...(eta !== undefined ? { etaSeconds: eta } : {}),
  };
}

export async function waitReasons(
  sql: SqlExecutor,
  rows: readonly JobRow[],
): Promise<Map<string, WaitReason>> {
  const reasons = new Map<string, WaitReason>();
  for (const row of rows) {
    if (row.state === 'pending') reasons.set(row.id, waitsFor(row, rows));
    else if (row.state === 'ready') reasons.set(row.id, await inQueue(sql, row));
  }
  return reasons;
}
