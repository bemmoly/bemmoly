import {
  createDatabase,
  createSqlClient,
  pingDatabase,
  type Database,
  type DatabaseProbe,
  type SqlClient,
} from '@bemmoly/core';
import type { Env } from '@bemmoly/core/config';

export interface DatabaseConnection {
  sql: SqlClient;
  /** The one Drizzle instance on `sql`; every service that takes a Database gets this. */
  db: Database;
  probe: DatabaseProbe;
}

export function connectDatabase(env: Pick<Env, 'DATABASE_URL'>): DatabaseConnection | undefined {
  if (!env.DATABASE_URL) return undefined;
  const sql = createSqlClient(env.DATABASE_URL, { applicationName: 'bemmoly-server' });
  return {
    sql,
    db: createDatabase(sql),
    probe: { ping: (timeoutMs) => pingDatabase(sql, timeoutMs) },
  };
}
