import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSqlClient, type SqlClient } from '../../clients/postgres.ts';
import { createIsolatedDatabase, type IsolatedDatabase } from '../../testing/isolated-database.ts';
import { kernelChangelogRunner } from '../../testing/kernel-changelog.ts';
import { startTestDatabase, type TestDatabase } from '../../testing/postgres.ts';
import { createRunnerChangelogProbe } from './changelog-probe.ts';

describe('the system service reads the changelog through the runner', () => {
  let server: TestDatabase;
  let database: IsolatedDatabase | undefined;
  let sql: SqlClient | undefined;

  beforeAll(async () => {
    server = await startTestDatabase();
    if (!server.available) return;
    database = await createIsolatedDatabase(server.url);
    sql = createSqlClient(database.url, { maxConnections: 2 });
  });

  afterAll(async () => {
    await sql?.end({ timeout: 5 });
    await database?.drop();
    if (server.available) await server.stop();
  });

  it('updates, reads the newest tag and lists what a rollback to a tag would undo', async (ctx) => {
    if (!sql) return ctx.skip(server.available ? 'no database' : server.reason);
    const runner = await kernelChangelogRunner(sql);
    const probe = createRunnerChangelogProbe({
      runner,
      contexts: ['test'],
      enabledModules: () => [],
    });
    expect(await probe.latestTag()).toBeNull();
    expect(await probe.update()).toBeGreaterThan(0);
    expect(await probe.update()).toBe(0);
    expect(await probe.changesSince('1.0.0')).toBeNull();

    await runner.rollback('core', { count: 1 });
    await runner.tag('1.0.0');
    expect(await probe.latestTag()).toBe('1.0.0');
    expect(await probe.changesSince('1.0.0')).toEqual([]);

    expect(await probe.update()).toBe(1);
    const since = await probe.changesSince('1.0.0');
    expect(since).toHaveLength(1);
    expect(since?.[0]).toMatchObject({ module: 'core', hasDown: true, irreversible: false });
  });
});
