import type { SqlClient } from '../../clients/postgres.ts';
import { ensureChangelogTable, type Connection } from './store.ts';

/** One advisory lock key for every changelog run in the database ("bemmoly" in ASCII). */
export const CHANGELOG_LOCK_KEY = '27696068379503737';

/**
 * Runs `work` on one reserved connection that holds the session-level advisory
 * lock, so replicas starting together apply each changeset exactly once. The
 * second runner waits, then finds nothing pending.
 */
export async function withChangelogLock<T>(
  sql: SqlClient,
  work: (connection: Connection) => Promise<T>,
): Promise<T> {
  const connection = await sql.reserve();
  try {
    // Changesets may run long; the pool's statement timeout does not apply here.
    await connection`set statement_timeout = 0`;
    await connection`select pg_advisory_lock(${CHANGELOG_LOCK_KEY}::bigint)`;
    try {
      await ensureChangelogTable(connection);
      return await work(connection);
    } finally {
      await connection`select pg_advisory_unlock(${CHANGELOG_LOCK_KEY}::bigint)`;
    }
  } finally {
    await connection`reset statement_timeout`.catch(() => undefined);
    connection.release();
  }
}

/** A reserved connection without the lock, for read-only commands such as plan. */
export async function withConnection<T>(
  sql: SqlClient,
  work: (connection: Connection) => Promise<T>,
): Promise<T> {
  const connection = await sql.reserve();
  try {
    return await work(connection);
  } finally {
    connection.release();
  }
}
