import {
  createDatabase,
  createSqlClient,
  pingDatabase,
  type Database,
  type DatabaseProbe,
  type PoolEvent,
  type SqlClient,
} from '@bemmoly/core';
import type { Env, Logger } from '@bemmoly/core/config';
import { getMetrics, instrumentSqlClient, postgresPoolStats } from '@bemmoly/core/telemetry';

const APPLICATION_NAME = 'bemmoly-server';
const MAX_CONNECTIONS = 10;

/**
 * Job handlers run on the same pool as requests. Where one process does both, jobs may hold
 * at most 4 of its 10 connections, so a burst of jobs never makes a request wait for one; a
 * worker-only process keeps 2 back for its health checks.
 */
export function jobHandlerLimit(role: Env['BEMMOLY_ROLE']): number {
  return role === 'worker' ? MAX_CONNECTIONS - 2 : MAX_CONNECTIONS / 2 - 1;
}

export interface DatabaseConnection {
  sql: SqlClient;
  /** The one Drizzle instance on `sql`; every service that takes a Database gets this. */
  db: Database;
  probe: DatabaseProbe;
}

type PoolEnv = Pick<
  Env,
  | 'DATABASE_URL'
  | 'BEMMOLY_DB_STATEMENT_TIMEOUT_MS'
  | 'BEMMOLY_DB_IDLE_IN_TRANSACTION_TIMEOUT_MS'
  | 'BEMMOLY_DB_ACQUIRE_TIMEOUT_MS'
  | 'BEMMOLY_DB_NESTED_ACQUIRE'
>;

/**
 * A starved pool or a nested acquire is an outage in the making, so both are logged at
 * error level with the statement, never the values.
 */
function logPoolEvent(logger: Logger | undefined, event: PoolEvent): void {
  if (!logger) return;
  if (event.kind === 'acquire_timeout') {
    logger.error(
      { component: 'database', waitedMs: event.waitedMs, statement: event.statement },
      'No database connection came free in time; the request failed with 503',
    );
  } else {
    logger.error(
      { component: 'database', statement: event.statement, stack: event.stack },
      'A query asked the pool for a second connection while its transaction holds one',
    );
  }
}

/** The host's one pool: Drizzle's type handling fixed once, traced when tracing is on. */
export function connectDatabase(
  env: Pick<Env, 'DATABASE_URL'> & Partial<PoolEnv>,
  logger?: Logger,
): DatabaseConnection | undefined {
  if (!env.DATABASE_URL) return undefined;
  const sql = instrumentSqlClient(
    createSqlClient(env.DATABASE_URL, {
      applicationName: APPLICATION_NAME,
      maxConnections: MAX_CONNECTIONS,
      ...(env.BEMMOLY_DB_STATEMENT_TIMEOUT_MS === undefined
        ? {}
        : { statementTimeoutMs: env.BEMMOLY_DB_STATEMENT_TIMEOUT_MS }),
      ...(env.BEMMOLY_DB_IDLE_IN_TRANSACTION_TIMEOUT_MS === undefined
        ? {}
        : { idleInTransactionTimeoutMs: env.BEMMOLY_DB_IDLE_IN_TRANSACTION_TIMEOUT_MS }),
      ...(env.BEMMOLY_DB_ACQUIRE_TIMEOUT_MS === undefined
        ? {}
        : { acquireTimeoutMs: env.BEMMOLY_DB_ACQUIRE_TIMEOUT_MS }),
      ...(env.BEMMOLY_DB_NESTED_ACQUIRE === undefined
        ? {}
        : { nestedAcquire: env.BEMMOLY_DB_NESTED_ACQUIRE }),
      onPoolEvent: (event) => logPoolEvent(logger, event),
    }),
  );
  getMetrics().database.observePool(
    postgresPoolStats(sql, { applicationName: APPLICATION_NAME, max: MAX_CONNECTIONS }),
  );
  return {
    sql,
    db: createDatabase(sql),
    probe: { ping: (timeoutMs) => pingDatabase(sql, timeoutMs) },
  };
}
