import type { SqlClient } from '../../clients/index.ts';
import type { DatabasePoolStats, MetricSource } from '../../contracts/telemetry.ts';

export interface PoolStatsOptions {
  /** The application_name the client connects with; connections are counted by it. */
  applicationName: string;
  max: number;
}

interface StateRow {
  state: string | null;
  connections: number;
}

/**
 * Pool stats as Postgres sees them, read from pg_stat_activity on each scrape.
 * postgres.js exposes no pool counters, and the server's view also catches
 * connections stuck idle in a transaction. Replicas sharing an application_name
 * are counted together.
 */
export function postgresPoolStats(
  sql: SqlClient,
  options: PoolStatsOptions,
): MetricSource<DatabasePoolStats> {
  return async () => {
    const rows = await sql<StateRow[]>`
      select state, count(*)::int as connections
      from pg_stat_activity
      where application_name = ${options.applicationName} and pid <> pg_backend_pid()
      group by state
    `;
    const count = (predicate: (state: string) => boolean) =>
      rows
        .filter((row) => predicate(row.state ?? ''))
        .reduce((sum, row) => sum + row.connections, 0);
    return {
      max: options.max,
      active: count((state) => state === 'active'),
      idle: count((state) => state === 'idle'),
      idleInTransaction: count((state) => state.startsWith('idle in transaction')),
    };
  };
}
