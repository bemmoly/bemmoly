/**
 * TEMPORARY: a minimal changeset applier for integration tests until the
 * changelog runner lands. It runs `up` (or `down`) in order, with no checksums,
 * preconditions or tracking table. Delete it when the runner can be used here.
 */
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SqlClient } from '../clients/postgres.ts';
import type { Changeset, ChangesetContext } from '../contracts/changelog.ts';

const dialect = new PgDialect();

function contextFor(sql: SqlClient): ChangesetContext {
  return {
    async exec(statement) {
      const query = dialect.sqlToQuery(statement);
      await sql.unsafe(query.sql, query.params as never[]);
    },
    async query(statement) {
      const query = dialect.sqlToQuery(statement);
      return (await sql.unsafe(query.sql, query.params as never[])) as never;
    },
    async backfill() {
      throw new Error('backfill is not supported by the temporary applier');
    },
    services: {},
    log: () => undefined,
  };
}

export async function applyChangesets(
  sql: SqlClient,
  changesets: readonly Changeset[],
): Promise<void> {
  for (const changeset of changesets) {
    await sql.begin(async (tx) => changeset.up(contextFor(tx as unknown as SqlClient)));
  }
}

export async function revertChangesets(
  sql: SqlClient,
  changesets: readonly Changeset[],
): Promise<void> {
  for (const changeset of [...changesets].reverse()) {
    if (!changeset.down) throw new Error(`${changeset.id} has no down`);
    const down = changeset.down.bind(changeset);
    await sql.begin(async (tx) => down(contextFor(tx as unknown as SqlClient)));
  }
}

/** Stands in for the identity changesets: just enough of `users` for foreign keys. */
export async function createUsersStub(sql: SqlClient): Promise<void> {
  await sql`create table if not exists users (id uuid primary key default uuidv7())`;
}
