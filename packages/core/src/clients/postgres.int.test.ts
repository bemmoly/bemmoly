import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestDatabase, type TestDatabase } from '../testing/postgres.ts';
import { createSqlClient, pingDatabase, type SqlClient } from './postgres.ts';

describe('postgres client against a real database', () => {
  let database: TestDatabase;
  let sql: SqlClient | undefined;

  beforeAll(async () => {
    database = await startTestDatabase();
    if (database.available) sql = createSqlClient(database.url, { maxConnections: 2 });
  });

  afterAll(async () => {
    await sql?.end({ timeout: 5 });
    if (database.available) await database.stop();
  });

  it('connects and runs select 1', async (ctx) => {
    if (!database.available || !sql)
      return ctx.skip(database.available ? 'no client' : database.reason);
    const rows = await sql<{ one: number }[]>`select 1 as one`;
    expect(rows[0]?.one).toBe(1);
    await expect(pingDatabase(sql, 2_000)).resolves.toBeUndefined();
  });

  it('runs on Postgres 18 with pgvector available', async (ctx) => {
    if (!database.available || !sql)
      return ctx.skip(database.available ? 'no client' : database.reason);
    const [version] = await sql<{ server_version_num: string }[]>`show server_version_num`;
    expect(Number(version?.server_version_num)).toBeGreaterThanOrEqual(180_000);
    const [vector] = await sql<{ available: boolean }[]>`
      select exists(select 1 from pg_available_extensions where name = 'vector') as available`;
    expect(vector?.available).toBe(true);
  });
});
