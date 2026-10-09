import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSqlClient, type SqlClient } from '../../clients/postgres.ts';
import { createIsolatedDatabase, type IsolatedDatabase } from '../../testing/isolated-database.ts';
import { applyKernelChangelog } from '../../testing/kernel-changelog.ts';
import { startTestDatabase, type TestDatabase } from '../../testing/postgres.ts';
import { createContainerMemberships } from './memberships.ts';

describe('container memberships', () => {
  let server: TestDatabase;
  let database: IsolatedDatabase;
  let sql: SqlClient;
  const people: Record<string, string> = {};
  const roles: Record<string, string> = {};
  let teamId = '';

  const person = async (name: string, status = 'active') => {
    const [row] = await sql<{ id: string }[]>`
      insert into users (email, name, status, role_id)
      select ${`${name}@example.test`}, ${name}, ${status}, id from roles where key = 'viewer'
      returning id`;
    people[name] = row!.id;
  };

  beforeAll(async () => {
    server = await startTestDatabase();
    if (!server.available) return;
    database = await createIsolatedDatabase(server.url);
    sql = createSqlClient(database.url, { maxConnections: 4 });
    await applyKernelChangelog(sql);
    for (const row of await sql<{ id: string; key: string }[]>`select id, key from roles`) {
      roles[row.key] = row.id;
    }
    for (const name of ['ada', 'bo', 'cy']) await person(name);
    await person('dee', 'deactivated');
    const [team] = await sql<{ id: string }[]>`
      insert into teams (name, default_role_id) values ('Core', ${roles['viewer']!}) returning id`;
    teamId = team!.id;
    for (const name of ['bo', 'cy', 'dee']) {
      await sql`insert into team_members (team_id, user_id) values (${teamId}, ${people[name]!})`;
    }
  });

  afterAll(async () => {
    if (!server.available) return;
    await sql.end({ timeout: 5 });
    await database.drop();
    await server.stop();
  });

  it('adds people and teams once, with the picked, team or member role', async (context) => {
    if (!server.available) return context.skip();
    const memberships = createContainerMemberships(sql);
    const project = randomUUID();
    const added = await memberships.add('project', project, {
      userIds: [people['ada']!, people['bo']!],
      teamIds: [teamId],
    });
    const byName = Object.fromEntries(added.map((member) => [member.name, member.roleKey]));
    expect(byName).toEqual({ ada: 'member', bo: 'member', cy: 'viewer' });
    const again = await memberships.add('project', project, {
      teamIds: [teamId],
      roleId: roles['project_admin']!,
    });
    expect(again).toEqual([]);
    expect((await memberships.list('project', project)).map((member) => member.name)).toEqual([
      'ada',
      'bo',
      'cy',
    ]);
  });

  it('changes a role and removes a member of one container only', async (context) => {
    if (!server.available) return context.skip();
    const memberships = createContainerMemberships(sql);
    const [one, two] = [randomUUID(), randomUUID()];
    for (const container of [one, two]) {
      await memberships.add('project', container, { userIds: [people['ada']!] });
    }
    const changed = await memberships.setRole('project', one, people['ada']!, roles['viewer']!);
    expect(changed?.roleKey).toBe('viewer');
    expect(await memberships.setRole('project', one, people['bo']!, roles['viewer']!)).toBeNull();
    expect(await memberships.remove('project', one, people['ada']!)).toBe(true);
    expect(await memberships.remove('project', one, people['ada']!)).toBe(false);
    expect(await memberships.list('project', one)).toEqual([]);
    expect((await memberships.list('project', two))[0]?.roleKey).toBe('member');
    await expect(memberships.setRole('space', two, people['ada']!, randomUUID())).rejects.toThrow(
      'The role was not found',
    );
  });

  it('lists every role, system roles first', async (context) => {
    if (!server.available) return context.skip();
    const keys = (await createContainerMemberships(sql).roles()).map((role) => role.key);
    expect(keys.slice(0, 5)).toEqual([
      'org_admin',
      'project_admin',
      'member',
      'viewer',
      'contractor',
    ]);
  });
});
