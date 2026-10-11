import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { guardPool, type NestedAcquirePolicy, type PoolEvent } from './pool-guard.ts';

export type SqlClient = postgres.Sql;

export const DEFAULT_STATEMENT_TIMEOUT_MS = 10_000;
export const DEFAULT_IDLE_IN_TRANSACTION_TIMEOUT_MS = 60_000;
export const DEFAULT_ACQUIRE_TIMEOUT_MS = 10_000;

export interface SqlClientOptions {
  applicationName?: string;
  maxConnections?: number;
  connectTimeoutSeconds?: number;
  /** 0 disables the timeout (database tools, long changesets). */
  statementTimeoutMs?: number;
  /**
   * How long a connection may sit idle inside an open transaction before Postgres ends it,
   * so a transaction whose caller hangs cannot hold its connection forever. 0 disables it.
   */
  idleInTransactionTimeoutMs?: number;
  /** How long a query or transaction may wait for a free connection; 0 waits forever. */
  acquireTimeoutMs?: number;
  /**
   * A pool query made while the same async context holds one of the pool's transactions.
   * Defaults to `throw`, so every test catches the deadlock; the server reads its policy from
   * BEMMOLY_DB_NESTED_ACQUIRE.
   */
  nestedAcquire?: NestedAcquirePolicy;
  /** Starved waits and nested acquires, for the host to log. */
  onPoolEvent?: (event: PoolEvent) => void;
  /** Called with the text of every statement sent; the query-count assertion uses it. */
  onQuery?: (statement: string) => void;
}

/**
 * The Postgres pool. Drizzle's driver replaces the date/time parsers and the
 * json serializers of any client it wraps; wrapping here, once, makes that
 * behaviour fixed for the pool's whole life rather than dependent on whether
 * some service has called drizzle() yet. Consequence for raw tagged queries:
 * date and time columns arrive as strings (wrap them in `new Date()`), date
 * parameters must be bound as text (`${date.toISOString()}::timestamptz`), and
 * JSON parameters are sent as text (`${JSON.stringify(value)}::jsonb`).
 *
 * Every connection carries a statement timeout and an idle-in-transaction timeout, and the
 * pool fails a starved wait with a 503 rather than queueing forever (pool-guard.ts).
 */
export function createSqlClient(url: string, options: SqlClientOptions = {}): SqlClient {
  const sql = postgres(url, {
    max: options.maxConnections ?? 10,
    connect_timeout: options.connectTimeoutSeconds ?? 5,
    idle_timeout: 30,
    onnotice: () => undefined,
    ...(options.onQuery
      ? { debug: (_connection: number, statement: string) => options.onQuery?.(statement) }
      : {}),
    connection: {
      application_name: options.applicationName ?? 'bemmoly',
      statement_timeout: options.statementTimeoutMs ?? DEFAULT_STATEMENT_TIMEOUT_MS,
      idle_in_transaction_session_timeout:
        options.idleInTransactionTimeoutMs ?? DEFAULT_IDLE_IN_TRANSACTION_TIMEOUT_MS,
    },
  });
  drizzle({ client: sql });
  return guardPool(sql, {
    acquireTimeoutMs: options.acquireTimeoutMs ?? DEFAULT_ACQUIRE_TIMEOUT_MS,
    nestedAcquire: options.nestedAcquire ?? 'throw',
    ...(options.onPoolEvent ? { onEvent: options.onPoolEvent } : {}),
  });
}

export class TimeoutError extends Error {
  override readonly name = 'TimeoutError';
}

/** Runs `select 1` and fails after `timeoutMs`, cancelling the query. */
export async function pingDatabase(sql: SqlClient, timeoutMs: number): Promise<void> {
  const query = sql`select 1 as ok`;
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      void query.cancel();
      reject(new TimeoutError(`Database did not answer within ${timeoutMs} ms`));
    }, timeoutMs);
  });
  try {
    await Promise.race([query, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
