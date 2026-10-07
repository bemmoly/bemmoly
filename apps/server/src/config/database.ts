import { createSqlClient, pingDatabase, type DatabaseProbe, type SqlClient } from '@bemmoly/core';
import type { Env } from '@bemmoly/core/config';

export interface DatabaseConnection {
  sql: SqlClient;
  probe: DatabaseProbe;
}

export function connectDatabase(env: Pick<Env, 'DATABASE_URL'>): DatabaseConnection | undefined {
  if (!env.DATABASE_URL) return undefined;
  const sql = createSqlClient(env.DATABASE_URL, { applicationName: 'bemmoly-server' });
  return { sql, probe: { ping: (timeoutMs) => pingDatabase(sql, timeoutMs) } };
}
