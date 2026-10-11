import type { QueueDepth } from '../../contracts/telemetry.ts';
import type { SqlExecutor } from '../../contracts/sql.ts';

/**
 * Jobs waiting per queue, split by whether they could run now. pg-boss's own queuedCount
 * also counts jobs whose start_after is in the future (scheduled digests, retries backing
 * off), so an idle install read as backlogged. Ready means created or retry and due.
 */
export async function readQueueDepths(
  sql: SqlExecutor,
  queues: readonly string[],
): Promise<Record<string, QueueDepth>> {
  const depths: Record<string, QueueDepth> = Object.fromEntries(
    queues.map((queue) => [queue, { ready: 0, delayed: 0 }]),
  );
  if (queues.length === 0) return depths;
  const rows = await sql<{ name: string; ready: number; delayed: number }[]>`
    select name,
           count(*) filter (where start_after <= now())::int as ready,
           count(*) filter (where start_after > now())::int as delayed
    from pgboss.job
    where state in ('created', 'retry') and name = any(${[...queues]}::text[])
    group by name`;
  for (const row of rows) depths[row.name] = { ready: row.ready, delayed: row.delayed };
  return depths;
}
