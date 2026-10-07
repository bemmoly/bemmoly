import type { PgAsyncDatabase } from 'drizzle-orm/pg-core/async';
import { drizzle, type PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import type postgres from 'postgres';
import type { SqlClient } from './postgres.ts';

/** A Drizzle database or an open transaction on it; services accept either. */
export type Database = PgAsyncDatabase<PostgresJsQueryResultHKT>;

export function createDatabase(sql: SqlClient): Database {
  return drizzle({ client: sql });
}

/**
 * Drizzle over a transaction opened with the pool's `begin()`, so raw queries
 * and Drizzle queries share it. postgres.js transaction handles carry no
 * `options`, which Drizzle's driver reads to install its type parsers; the
 * handle borrows the pool's, which createSqlClient has already fitted.
 */
export function createTransactionDatabase(
  pool: SqlClient,
  transaction: postgres.TransactionSql,
): Database {
  const client = Object.assign(transaction, { options: pool.options });
  return drizzle({ client: client as unknown as SqlClient });
}
