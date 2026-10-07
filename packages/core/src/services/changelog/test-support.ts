import { sql } from 'drizzle-orm';
import type { Changeset } from '../../contracts/changelog.ts';
import { createSqlClient, type SqlClient } from '../../clients/postgres.ts';
import { createIsolatedDatabase, type IsolatedDatabase } from '../../testing/isolated-database.ts';
import type { TestDatabase } from '../../testing/postgres.ts';

/** Shared by the changelog integration tests; not part of the service's API. */
export interface Fresh {
  sql: SqlClient;
  database: IsolatedDatabase;
  close(): Promise<void>;
}

export async function freshDatabase(server: TestDatabase & { available: true }): Promise<Fresh> {
  const database = await createIsolatedDatabase(server.url);
  const client = createSqlClient(database.url, { maxConnections: 4 });
  return {
    sql: client,
    database,
    async close() {
      await client.end({ timeout: 5 });
      await database.drop();
    },
  };
}

export function createTable(
  id: string,
  table: string,
  overrides: Partial<Changeset> = {},
): Changeset {
  return {
    id,
    author: 'test',
    description: `create ${table}`,
    up: async (ctx) => {
      await ctx.exec(
        sql.raw(`create table ${table} (id uuid primary key default uuidv7(), n int)`),
      );
    },
    down: async (ctx) => {
      await ctx.exec(sql.raw(`drop table ${table}`));
    },
    ...overrides,
  };
}

export async function tableExists(client: SqlClient, table: string): Promise<boolean> {
  const [row] = await client<
    { exists: boolean }[]
  >`select to_regclass(${table}) is not null as exists`;
  return row?.exists ?? false;
}

export async function states(client: SqlClient): Promise<Record<string, string>> {
  const rows = await client<{ module: string; id: string; state: string }[]>`
    select module, id, state from schema_changelog order by order_executed`;
  return Object.fromEntries(rows.map((row) => [`${row.module}/${row.id}`, row.state]));
}
