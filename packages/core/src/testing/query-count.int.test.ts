import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSqlClient, type SqlClient } from '../clients/index.ts';
import { startTestDatabase, type TestDatabase } from './postgres.ts';
import { createQueryCounter, expectMaxQueries, QueryBudgetExceededError } from './query-count.ts';

describe('query-count assertion against a real database', () => {
  const counter = createQueryCounter();
  let database: TestDatabase;
  let sql: SqlClient | undefined;

  beforeAll(async () => {
    database = await startTestDatabase();
    if (!database.available) return;
    sql = createSqlClient(database.url, { maxConnections: 2, onQuery: counter.record });
    await sql`create temporary table if not exists qc_items (id int primary key, parent int)`;
  });

  afterAll(async () => {
    await sql?.end({ timeout: 5 });
    if (database.available) await database.stop();
  });

  it('lets one joined query through and catches the N+1 version', async (ctx) => {
    if (!database.available || !sql)
      return ctx.skip(database.available ? 'no client' : database.reason);
    const client = sql;
    await client.begin(async (tx) => {
      await tx`delete from qc_items`;
      await tx`insert into qc_items ${tx([1, 2, 3].map((id) => ({ id, parent: 0 })))}`;
    });

    const rows = await expectMaxQueries(
      counter,
      1,
      () => client<{ id: number }[]>`select id from qc_items order by id`,
    );
    expect(rows.map((row) => row.id)).toEqual([1, 2, 3]);

    const nPlusOne = expectMaxQueries(counter, 1, async () => {
      const ids = await client<{ id: number }[]>`select id from qc_items order by id`;
      for (const { id } of ids) await client`select * from qc_items where parent = ${id}`;
    });
    await expect(nPlusOne).rejects.toBeInstanceOf(QueryBudgetExceededError);
    await expect(nPlusOne).rejects.toThrow(/at most 1 queries, ran 4/);
  });

  it('does not count BEGIN and COMMIT around a transaction', async (ctx) => {
    if (!database.available || !sql)
      return ctx.skip(database.available ? 'no client' : database.reason);
    const client = sql;
    await expectMaxQueries(counter, 2, () =>
      client.begin(async (tx) => {
        await tx`update qc_items set parent = 1 where id = 2`;
        await tx`select count(*) from qc_items`;
      }),
    );
  });
});
