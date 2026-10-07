import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export type SqlClient = postgres.Sql;

export interface SqlClientOptions {
  applicationName?: string;
  maxConnections?: number;
  connectTimeoutSeconds?: number;
  /** 0 disables the timeout (database tools, long changesets). */
  statementTimeoutMs?: number;
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
      statement_timeout: options.statementTimeoutMs ?? 10_000,
    },
  });
  drizzle({ client: sql });
  return sql;
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
