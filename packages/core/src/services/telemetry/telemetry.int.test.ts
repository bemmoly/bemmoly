import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createSqlClient, type SqlClient } from '../../clients/index.ts';
import { startTestDatabase, type TestDatabase } from '../../testing/postgres.ts';
import { postgresPoolStats } from './pool-stats.ts';
import { instrumentSqlClient } from './postgres-tracing.ts';

const APPLICATION_NAME = 'bemmoly-telemetry-test';

describe('telemetry against a real database', () => {
  const exporter = new InMemorySpanExporter();
  const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
  let database: TestDatabase;
  let raw: SqlClient | undefined;
  let sql: SqlClient | undefined;

  beforeAll(async () => {
    database = await startTestDatabase();
    if (!database.available) return;
    raw = createSqlClient(database.url, { maxConnections: 3, applicationName: APPLICATION_NAME });
    sql = instrumentSqlClient(raw, { tracer: provider.getTracer('test') });
  });

  beforeEach(() => exporter.reset());

  afterAll(async () => {
    await raw?.end({ timeout: 5 });
    await provider.shutdown();
    if (database.available) await database.stop();
  });

  const spans = () =>
    exporter.getFinishedSpans().map((span) => ({ name: span.name, ...span.attributes }));

  it('adds one span per awaited query with the statement and never the values', async (ctx) => {
    if (!database.available || !sql)
      return ctx.skip(database.available ? 'no client' : database.reason);
    const secret = 'value-that-must-not-be-recorded';
    const fragment = sql`${secret}::text`;
    const rows = await sql<{ echoed: string }[]>`select ${fragment} as echoed`;
    expect(rows[0]?.echoed).toBe(secret);
    await sql.unsafe('select $1::int as n', [7]);
    await sql.unsafe('select 1');
    expect(spans()).toEqual([
      expect.objectContaining({
        name: 'SELECT',
        'db.system.name': 'postgresql',
        'db.operation.name': 'SELECT',
        'db.query.text': 'select $1 as echoed',
      }),
      expect.objectContaining({ name: 'SELECT', 'db.query.text': 'select $1::int as n' }),
      expect.not.objectContaining({ 'db.query.text': expect.anything() }),
    ]);
    expect(JSON.stringify(spans())).not.toContain(secret);
  });

  it('traces inside transactions and marks failed queries as errors', async (ctx) => {
    if (!database.available || !sql)
      return ctx.skip(database.available ? 'no client' : database.reason);
    await sql.begin(async (tx) => {
      await tx`select 1`;
      await tx.savepoint(async (inner) => inner`select 2`);
    });
    await expect(sql`select * from table_that_does_not_exist`).rejects.toThrow();
    const finished = exporter.getFinishedSpans();
    expect(finished).toHaveLength(3);
    expect(finished[2]?.status.code).toBe(2);
    expect(finished[2]?.events.some((event) => event.name === 'exception')).toBe(true);
  });

  it('reports pool stats from pg_stat_activity', async (ctx) => {
    if (!database.available || !raw)
      return ctx.skip(database.available ? 'no client' : database.reason);
    const client = raw;
    const stats = postgresPoolStats(client, { applicationName: APPLICATION_NAME, max: 3 });
    await client.begin(async (tx) => {
      await tx`select 1`;
      const reserved = await client.reserve();
      try {
        const snapshot = await stats();
        expect(snapshot.max).toBe(3);
        expect(snapshot.idleInTransaction).toBeGreaterThanOrEqual(1);
        expect(snapshot.active + snapshot.idle + snapshot.idleInTransaction).toBeGreaterThanOrEqual(
          1,
        );
      } finally {
        reserved.release();
      }
    });
  });
});
