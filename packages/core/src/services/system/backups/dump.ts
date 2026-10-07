import { createWriteStream } from 'node:fs';
import type postgres from 'postgres';
import type { PgTools } from '../../../clients/pg-tools.ts';
import type { SqlClient } from '../../../clients/postgres.ts';
import { createDigestStream, type Digest } from '../utils/hashing.ts';

/** Tables whose row counts the restore drill compares; missing tables are skipped. */
export const KEY_TABLES = ['users', 'issues', 'pages', 'schema_changelog'] as const;

export interface DumpResult extends Digest {
  serverVersion: string;
  rowCounts: Record<string, number>;
}

/** Runs inside a transaction so the counts share the dump's snapshot. */
export async function countKeyTables(
  sql: postgres.TransactionSql,
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of KEY_TABLES) {
    const [present] = await sql<{ ok: boolean }[]>`select to_regclass(${table}) is not null as ok`;
    if (!present?.ok) continue;
    const [row] = await sql<{ count: string }[]>`select count(*)::text as count from ${sql(table)}`;
    counts[table] = Number(row?.count ?? 0);
  }
  return counts;
}

/**
 * pg_dump in custom format inside one repeatable-read snapshot, which the row counts
 * share, so the drill can demand exact equality after a restore.
 */
export async function dumpDatabase(
  sql: SqlClient,
  pgTools: PgTools,
  databaseUrl: string,
  file: string,
): Promise<DumpResult> {
  return sql.begin('isolation level repeatable read read only', async (tx) => {
    // Counting large tables outlasts the request pool's statement timeout.
    await tx`set local statement_timeout = 0`;
    const [snapshot] = await tx<{ id: string }[]>`select pg_export_snapshot() as id`;
    const [version] = await tx<{ server_version: string }[]>`show server_version`;
    const rowCounts = await countKeyTables(tx);
    const digest = createDigestStream();
    const out = createWriteStream(file, { mode: 0o640 });
    const writing = new Promise<void>((resolve, reject) => {
      out.once('finish', resolve);
      out.once('error', reject);
    });
    digest.pipe(out);
    await pgTools.dump(databaseUrl, digest, snapshot?.id ? { snapshot: snapshot.id } : {});
    await writing;
    return {
      ...digest.digest(),
      serverVersion: version?.server_version ?? 'unknown',
      rowCounts,
    };
  });
}
