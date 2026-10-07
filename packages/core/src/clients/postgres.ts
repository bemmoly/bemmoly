import postgres from 'postgres';

export type SqlClient = postgres.Sql;

export interface SqlClientOptions {
  applicationName?: string;
  maxConnections?: number;
  connectTimeoutSeconds?: number;
  statementTimeoutMs?: number;
  /** Called with the text of every statement sent; the query-count assertion uses it. */
  onQuery?: (statement: string) => void;
}

export function createSqlClient(url: string, options: SqlClientOptions = {}): SqlClient {
  return postgres(url, {
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
