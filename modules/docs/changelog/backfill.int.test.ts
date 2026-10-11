import { createChangelogRunner, createSqlClient, loadKernelChangelog } from '@bemmoly/core';
import {
  createIsolatedDatabase,
  startTestDatabase,
  type TestDatabase,
} from '@bemmoly/core/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import docs from '../module.ts';

/*
 * Spaces stored before membership was managed: the backfill makes their
 * creators space admins and their team's people members, and leaves rows
 * that already exist alone.
 */
describe('space members backfill', () => {
  let server: TestDatabase;

  beforeAll(async () => {
    server = await startTestDatabase();
  });

  afterAll(async () => {
    if (server.available) await server.stop();
  });

  it('adds creators and team members once, keeping existing roles', async (ctx) => {
    if (!server.available) return ctx.skip(server.reason);
    const database = await createIsolatedDatabase(server.url);
    const sql = createSqlClient(database.url, { maxConnections: 4 });
    try {
      const before = docs.changelog.filter((entry) => entry.id < '0014');
      const runner = (changelog: typeof docs.changelog) =>
        createChangelogRunner({
          sql,
          kernel: [],
          modules: [{ module: 'docs', changelog }],
          appVersion: '0.2.0',
        });
      const kernel = createChangelogRunner({
        sql,
        kernel: await loadKernelChangelog(),
        modules: [{ module: 'docs', changelog: before }],
        appVersion: '0.2.0',
      });
      await kernel.update({ contexts: ['production'] });
      const person = async (email: string, role: string) => {
        const [row] = await sql<{ id: string }[]>`
          insert into users (email, name, role_id)
          select ${email}, ${email}, id from roles where key = ${role} returning id`;
        return row!.id;
      };
      const creator = await person('cy@example.test', 'project_admin');
      const teammate = await person('ty@example.test', 'viewer');
      const already = await person('al@example.test', 'member');
      const [team] = await sql<
        { id: string }[]
      >`insert into teams (name) values ('Ops') returning id`;
      await sql`insert into team_members (team_id, user_id)
        values (${team!.id}, ${teammate}), (${team!.id}, ${already})`;
      const [space] = await sql<{ id: string }[]>`
        insert into spaces (key, name, team_id, created_by)
        values ('OPS', 'Ops', ${team!.id}, ${creator}) returning id`;
      await sql`insert into space_members (space_id, user_id, role_id)
        select ${space!.id}, ${already}, id from roles where key = 'viewer'`;

      await runner(docs.changelog).update({ contexts: ['production'] });
      const rows = await sql<{ user_id: string; key: string }[]>`
        select m.user_id, r.key from space_members m join roles r on r.id = m.role_id
        where m.space_id = ${space!.id}`;
      const roleOf = new Map(rows.map((row) => [row.user_id, row.key]));
      expect(roleOf.get(creator)).toBe('project_admin');
      expect(roleOf.get(teammate)).toBe('member');
      expect(roleOf.get(already)).toBe('viewer');
      expect(rows).toHaveLength(3);
    } finally {
      await sql.end({ timeout: 5 });
      await database.drop();
    }
  });
});
