import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSqlClient, type SqlClient } from '../../clients/postgres.ts';
import { createIsolatedDatabase, type IsolatedDatabase } from '../../testing/isolated-database.ts';
import { kernelChangelogRunner } from '../../testing/kernel-changelog.ts';
import { startTestDatabase, type TestDatabase } from '../../testing/postgres.ts';

const RETIRED = 'workspace.billing.manage';

describe('the retired billing capability', () => {
  let server: TestDatabase;
  let database: IsolatedDatabase;
  let sql: SqlClient;

  const stored = async () => {
    const [row] = await sql<{ org: number; project: number; space: number }[]>`
      select
        (select count(*)::int from role_capabilities where capability = ${RETIRED}) as org,
        (select count(*)::int from project_role_capabilities where capability = ${RETIRED}) as project,
        (select count(*)::int from space_role_capabilities where capability = ${RETIRED}) as space`;
    return row;
  };

  beforeAll(async () => {
    server = await startTestDatabase();
    if (!server.available) return;
    database = await createIsolatedDatabase(server.url);
    sql = createSqlClient(database.url, { maxConnections: 2 });
    await (await kernelChangelogRunner(sql)).update({ contexts: ['test'] });
  });

  afterAll(async () => {
    if (!server.available) return;
    await sql.end({ timeout: 5 });
    await database.drop();
    await server.stop();
  });

  it('leaves no stored grant on a fresh install', async (context) => {
    if (!server.available) return context.skip();
    expect(await stored()).toEqual({ org: 0, project: 0, space: 0 });
  });

  it('deletes grants an earlier install stored, and rolls back to the seeded cells', async (context) => {
    if (!server.available) return context.skip();
    const runner = await kernelChangelogRunner(sql);
    const reverted = await runner.rollback('core', { toId: '0108-identity-seed' });
    expect(reverted.map((entry) => entry.id)).toContain('0109-identity-drop-billing-capability');
    const seeded = await sql<{ key: string; allowed: boolean; locked: boolean }[]>`
      select r.key, rc.allowed, rc.locked_by_org as locked
        from role_capabilities rc join roles r on r.id = rc.role_id
       where rc.capability = ${RETIRED} order by r.key`;
    expect(seeded).toEqual([
      { key: 'contractor', allowed: false, locked: true },
      { key: 'member', allowed: false, locked: true },
      { key: 'org_admin', allowed: true, locked: true },
      { key: 'project_admin', allowed: false, locked: true },
      { key: 'viewer', allowed: false, locked: true },
    ]);

    const [role] = await sql<{ id: string }[]>`select id from roles where key = 'member'`;
    await sql`insert into project_role_capabilities (project_id, role_id, capability, allowed)
      values (${randomUUID()}, ${role!.id}, ${RETIRED}, false)`;
    await sql`insert into space_role_capabilities (space_id, role_id, capability, allowed)
      values (${randomUUID()}, ${role!.id}, ${RETIRED}, false)`;

    await runner.update({ contexts: ['test'] });
    expect(await stored()).toEqual({ org: 0, project: 0, space: 0 });
  });
});
