import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSqlClient, type SqlClient } from '../clients/postgres.ts';
import { applyIdentityChangesets, revertIdentityChangesets } from './identity-changelog.ts';
import { startTestDatabase, type TestDatabase } from './postgres.ts';

const TABLES = [
  'api_tokens',
  'audit_log',
  'auth_identities',
  'auth_providers',
  'invitations',
  'module_grants',
  'password_reset_tokens',
  'project_members',
  'project_role_capabilities',
  'rate_limit_buckets',
  'role_capabilities',
  'roles',
  'sessions',
  'space_members',
  'space_role_capabilities',
  'team_members',
  'teams',
  'users',
];

describe('identity changesets against a real database', () => {
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

  const tables = async (client: SqlClient) =>
    (
      await client<{ name: string }[]>`
        select table_name as name from information_schema.tables
        where table_schema = 'public' order by table_name`
    ).map((row) => row.name);

  it('applies, rolls back and re-applies cleanly', async (ctx) => {
    if (!database.available || !sql) return ctx.skip(database.available ? '' : database.reason);
    await applyIdentityChangesets(sql);
    expect(await tables(sql)).toEqual(TABLES);
    await revertIdentityChangesets(sql);
    expect(await tables(sql)).toEqual([]);
    await applyIdentityChangesets(sql);
    expect(await tables(sql)).toEqual(TABLES);
  });

  it('seeds the five system roles with the mock defaults and locks', async (ctx) => {
    if (!database.available || !sql) return ctx.skip(database.available ? '' : database.reason);
    const roles = await sql<{ key: string }[]>`select key from roles order by key`;
    expect(roles.map((role) => role.key)).toEqual([
      'contractor',
      'member',
      'org_admin',
      'project_admin',
      'viewer',
    ]);
    const cells = await sql<{ key: string; allowed: boolean; locked_by_org: boolean }[]>`
      select r.key, rc.allowed, rc.locked_by_org from role_capabilities rc
      join roles r on r.id = rc.role_id where rc.capability = 'ai.actions.run' order by r.key`;
    expect(cells.map((cell) => [cell.key, cell.allowed])).toEqual([
      ['contractor', false],
      ['member', true],
      ['org_admin', true],
      ['project_admin', true],
      ['viewer', false],
    ]);
    const [locked] = await sql<{ count: number }[]>`
      select count(distinct capability)::int as count from role_capabilities where locked_by_org`;
    expect(locked?.count).toBe(4);
  });

  it('keeps the audit log append-only', async (ctx) => {
    if (!database.available || !sql) return ctx.skip(database.available ? '' : database.reason);
    await sql`insert into audit_log (actor_kind, action, target_kind) values ('system', 'x', 'y')`;
    await expect(sql`update audit_log set action = 'z'`).rejects.toThrow(/append-only/);
    await expect(sql`delete from audit_log`).rejects.toThrow(/append-only/);
  });
});
