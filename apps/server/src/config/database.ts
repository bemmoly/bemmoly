import { createSqlClient, pingDatabase, type DatabaseProbe, type SqlClient } from '@bemmoly/core';
import type { Env } from '@bemmoly/core/config';
import { getMetrics, instrumentSqlClient, postgresPoolStats } from '@bemmoly/core/telemetry';

const APPLICATION_NAME = 'bemmoly-server';
const MAX_CONNECTIONS = 10;

export interface DatabaseConnection {
  sql: SqlClient;
  probe: DatabaseProbe;
}

export function connectDatabase(env: Pick<Env, 'DATABASE_URL'>): DatabaseConnection | undefined {
  if (!env.DATABASE_URL) return undefined;
  const sql = instrumentSqlClient(
    createSqlClient(env.DATABASE_URL, {
      applicationName: APPLICATION_NAME,
      maxConnections: MAX_CONNECTIONS,
    }),
  );
  getMetrics().database.observePool(
    postgresPoolStats(sql, { applicationName: APPLICATION_NAME, max: MAX_CONNECTIONS }),
  );
  return { sql, probe: { ping: (timeoutMs) => pingDatabase(sql, timeoutMs) } };
}
