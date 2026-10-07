import type { PgAsyncDatabase } from 'drizzle-orm/pg-core/async';
import { drizzle, type PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import type { SqlClient } from './postgres.ts';

/** A Drizzle database or an open transaction on it; services accept either. */
export type Database = PgAsyncDatabase<PostgresJsQueryResultHKT>;

export function createDatabase(sql: SqlClient): Database {
  return drizzle({ client: sql });
}
