import { createDatabase, type Database } from '../../clients/drizzle.ts';
import type { SqlClient } from '../../clients/postgres.ts';
import type { SqlExecutor } from '../../contracts/sql.ts';

/**
 * One transaction seen two ways: as Drizzle for this service's writes and as
 * the raw executor that event handlers receive in `DomainEvent.transaction`,
 * so an email outbox row commits or rolls back with the change that caused it.
 * Do not open a nested Drizzle transaction on `tx`; it is already one.
 */
export async function inSharedTransaction<T>(
  sql: SqlClient,
  work: (tx: Database, executor: SqlExecutor) => Promise<T>,
): Promise<T> {
  const result = await sql.begin(async (executor) =>
    work(createDatabase(executor as unknown as SqlClient), executor),
  );
  return result as T;
}
