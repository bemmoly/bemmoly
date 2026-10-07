import { startTestDatabase, type TestDatabase } from '@bemmoly/core/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app.ts';
import { connectDatabase, type DatabaseConnection } from './config/database.ts';
import { shippedModules, TEST_ENV } from './test-support.ts';

describe('readiness against a real database', () => {
  let database: TestDatabase;
  let connection: DatabaseConnection | undefined;

  beforeAll(async () => {
    database = await startTestDatabase();
    if (database.available) connection = connectDatabase({ DATABASE_URL: database.url });
  });

  afterAll(async () => {
    await connection?.sql.end({ timeout: 5 });
    if (database.available) await database.stop();
  });

  it('reports ready when Postgres answers', async (ctx) => {
    if (!database.available || !connection) {
      return ctx.skip(database.available ? 'no connection' : database.reason);
    }
    const app = await buildApp({
      env: TEST_ENV,
      modules: await shippedModules(),
      database: connection.probe,
      logger: false,
    });
    const response = await app.inject({ url: '/readyz' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'ready',
      checks: { database: { status: 'ok' } },
    });
  });
});
