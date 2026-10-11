import { UnavailableError } from '@bemmoly/shared';
import { sql as drizzleSql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestDatabase, type TestDatabase } from '../testing/postgres.ts';
import { createDatabase } from './drizzle.ts';
import { NestedPoolAcquireError, transactionInScope, type PoolEvent } from './pool-guard.ts';
import { createSqlClient, type SqlClient, type SqlClientOptions } from './postgres.ts';

/** The UnavailableError behind an error, however a driver or the ORM wrapped it. */
function unavailableIn(error: unknown): UnavailableError | undefined {
  for (let current = error; current; current = (current as { cause?: unknown }).cause) {
    if (current instanceof UnavailableError) return current;
  }
  return undefined;
}

const settle = <T>(promise: Promise<T>) =>
  promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );

describe('the pool guard against a real database', () => {
  let database: TestDatabase;
  const clients: SqlClient[] = [];

  const pool = (options: SqlClientOptions = {}) => {
    if (!database.available) throw new Error('no database');
    const client = createSqlClient(database.url, { maxConnections: 2, ...options });
    clients.push(client);
    return client;
  };

  beforeAll(async () => {
    database = await startTestDatabase();
  });

  afterAll(async () => {
    await Promise.all(clients.map((client) => client.end({ timeout: 5 })));
    if (database.available) await database.stop();
  });

  it('refuses every way of reaching the pool from inside its own transaction', async (ctx) => {
    if (!database.available) return ctx.skip(database.reason);
    const sql = pool();
    const db = createDatabase(sql);
    const attempts = await sql.begin(async (tx) => {
      await tx`select 1`;
      return Promise.all([
        settle(Promise.resolve(sql`select 1`)),
        settle(Promise.resolve(sql.unsafe('select 1'))),
        settle(db.execute(drizzleSql`select 1`)),
        settle(sql.begin(async (inner) => inner`select 1`)),
        settle(sql.reserve()),
        settle(Promise.resolve(tx`select 2 as two`)),
      ]);
    });
    const refused = attempts.slice(0, 5).map((attempt) => {
      if (attempt.ok) return 'ran';
      const error = attempt.error as { cause?: unknown };
      return error instanceof NestedPoolAcquireError ||
        error.cause instanceof NestedPoolAcquireError
        ? 'refused'
        : String(attempt.error);
    });
    expect(refused).toEqual(['refused', 'refused', 'refused', 'refused', 'refused']);
    expect(attempts[5]).toMatchObject({ ok: true, value: [{ two: 2 }] });
  });

  it('lets the pool through once the transaction has ended, even from work it started', async (ctx) => {
    if (!database.available) return ctx.skip(database.reason);
    const sql = pool();
    let later: Promise<unknown> = Promise.resolve();
    let release!: () => void;
    const committed = new Promise<void>((resolve) => (release = resolve));
    await sql.begin(async (tx) => {
      await tx`select 1`;
      later = committed.then(() => sql`select 1 as one`);
    });
    release();
    await expect(later).resolves.toEqual([{ one: 1 }]);
  });

  it('hands read-only lookups the transaction the calling code holds', async (ctx) => {
    if (!database.available) return ctx.skip(database.reason);
    const sql = pool();
    expect(transactionInScope(sql)).toBeUndefined();
    const seen = await sql.begin(async (tx) => {
      await tx`create temporary table only_here (id int) on commit drop`;
      const scoped = transactionInScope(sql);
      const [row] = await scoped!<{ found: boolean }[]>`
        select to_regclass('pg_temp.only_here') is not null as found`;
      return row?.found;
    });
    expect(seen).toBe(true);
  });

  it('reports a nested acquire and lets it run when told to warn', async (ctx) => {
    if (!database.available) return ctx.skip(database.reason);
    const events: PoolEvent[] = [];
    const sql = pool({ nestedAcquire: 'warn', onPoolEvent: (event) => events.push(event) });
    const rows = await sql.begin(async (tx) => {
      await tx`select 1`;
      return sql`select 7 as seven`;
    });
    expect(rows).toEqual([{ seven: 7 }]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'nested_acquire', statement: 'select 7 as seven' });
    expect((events[0] as { stack: string }).stack).toContain('pool-guard.int.test.ts');
  });

  it('turns the deadlock into errors that clear, instead of a pool that hangs forever', async (ctx) => {
    if (!database.available) return ctx.skip(database.reason);
    const events: PoolEvent[] = [];
    const sql = pool({
      maxConnections: 2,
      nestedAcquire: 'warn',
      acquireTimeoutMs: 500,
      onPoolEvent: (event) => events.push(event),
    });
    // Each transaction holds a connection and asks the pool for another: with two of them on
    // a pool of two, neither can ever get one. The first wait to time out fails its
    // transaction, whose rollback frees a connection for the other.
    const started = Date.now();
    const stuck = await Promise.all(
      [1, 2].map((n) =>
        settle(
          sql.begin(async (tx) => {
            await tx`select ${n}::int`;
            await new Promise((resolve) => setTimeout(resolve, 50));
            return sql`select ${n}::int as n`;
          }),
        ),
      ),
    );
    const outcomes = stuck.map((result) => (result.ok ? 'ran' : unavailableIn(result.error)?.code));
    expect(outcomes).toContain('unavailable');
    expect(outcomes.every((outcome) => outcome === 'ran' || outcome === 'unavailable')).toBe(true);
    expect(Date.now() - started).toBeLessThan(5_000);
    expect(events.filter((event) => event.kind === 'acquire_timeout').length).toBeGreaterThan(0);
    // Both transactions rolled back and gave their connections back.
    await expect(sql`select 1 as ok`).resolves.toEqual([{ ok: 1 }]);
    await expect(sql.begin((tx) => tx`select 2 as ok`)).resolves.toEqual([{ ok: 2 }]);
  });

  it('fails a transaction that cannot get a connection in time, and gives it back later', async (ctx) => {
    if (!database.available) return ctx.skip(database.reason);
    const sql = pool({ maxConnections: 1, acquireTimeoutMs: 300 });
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    let opened!: () => void;
    const ready = new Promise<void>((resolve) => (opened = resolve));
    const holder = sql.begin(async (tx) => {
      await tx`select 1`;
      opened();
      await held;
    });
    await ready;
    const waiting = await settle(sql.begin((tx) => tx`select 1`));
    expect(waiting.ok ? 'ran' : unavailableIn(waiting.error)?.code).toBe('unavailable');
    release();
    await holder;
    // The abandoned transaction got its connection once it came free, and handed it back.
    await expect(sql`select 3 as ok`).resolves.toEqual([{ ok: 3 }]);
  });

  it('ends a transaction left idle past the idle timeout, and the pool carries on', async (ctx) => {
    if (!database.available) return ctx.skip(database.reason);
    const sql = pool({ maxConnections: 1, idleInTransactionTimeoutMs: 200 });
    const idle = await settle(
      sql.begin(async (tx) => {
        await tx`select 1`;
        await new Promise((resolve) => setTimeout(resolve, 1_000));
        return tx`select 2`;
      }),
    );
    // Postgres ends the session; the driver reports the connection it lost.
    expect(idle).toMatchObject({ ok: false, error: { code: 'CONNECTION_CLOSED' } });
    await expect(sql`select 4 as ok`).resolves.toEqual([{ ok: 4 }]);
  });

  it('cancels a statement past the statement timeout, and the pool carries on', async (ctx) => {
    if (!database.available) return ctx.skip(database.reason);
    const sql = pool({ maxConnections: 1, statementTimeoutMs: 200 });
    await expect(sql`select pg_sleep(2)`).rejects.toMatchObject({ code: '57014' });
    await expect(sql`select 5 as ok`).resolves.toEqual([{ ok: 5 }]);
  });
});
