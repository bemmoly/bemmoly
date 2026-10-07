import type { SqlClient } from '../../clients/postgres.ts';
import type { ChangesetContext } from '../../contracts/changelog.ts';
import { SYSTEM_CHANGESETS } from './changelog.ts';
import { PgDialect } from 'drizzle-orm/pg-core';

const dialect = new PgDialect();

/**
 * Applies the system changesets directly, for images built before the changelog
 * runner (`bemmoly-db`) is present. Every system changeset is idempotent and carries a
 * markRan precondition, so the runner later records them without running them twice.
 */
export async function applySystemChangesets(
  sql: SqlClient,
  log: (line: string) => void,
): Promise<number> {
  let applied = 0;
  for (const changeset of SYSTEM_CHANGESETS) {
    await sql.begin(async (tx) => {
      const ctx: ChangesetContext = {
        async exec(statement) {
          const query = dialect.sqlToQuery(statement);
          await tx.unsafe(query.sql, query.params as never[]);
        },
        async query(statement) {
          const query = dialect.sqlToQuery(statement);
          return (await tx.unsafe(query.sql, query.params as never[])) as never;
        },
        async backfill() {
          throw new Error(`${changeset.id}: backfills need the changelog runner`);
        },
        services: {},
        log,
      };
      await changeset.up(ctx);
    });
    applied += 1;
    log(`applied core/${changeset.id}`);
  }
  return applied;
}
