import { createChangelogRunner, createSqlClient, loadKernelChangelog } from '@bemmoly/core';
import {
  createIsolatedDatabase,
  startTestDatabase,
  type TestDatabase,
} from '@bemmoly/core/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import work from '../module.ts';

/*
 * 0035 on an install whose custom role and project override were stored before the split:
 * each new action gets the cells of the one it came from, and down takes them back.
 */
describe('0035 action permissions', () => {
  let server: TestDatabase;

  beforeAll(async () => {
    server = await startTestDatabase();
  });

  afterAll(async () => {
    if (server.available) await server.stop();
  });

  it('copies stored cells onto the split actions and removes them on rollback', async (ctx) => {
    if (!server.available) return ctx.skip(server.reason);
    const database = await createIsolatedDatabase(server.url);
    const sql = createSqlClient(database.url, { maxConnections: 4 });
    try {
      const runner = createChangelogRunner({
        sql,
        kernel: await loadKernelChangelog(),
        modules: [{ module: 'work', changelog: work.changelog }],
        appVersion: '0.2.0',
      });
      await runner.update({ contexts: ['production'] });
      await runner.rollback('work', { toId: '0034-work-issue-archiving' });

      const [role] = await sql<{ id: string }[]>`
        insert into roles (key, name) values ('scrum_master', 'Scrum Master') returning id`;
      const roleId = (role as { id: string }).id;
      const [project] = await sql<{ id: string }[]>`
        insert into projects (key, name) values ('SM', 'Sprints') returning id`;
      const projectId = (project as { id: string }).id;
      await sql`
        insert into role_capabilities (role_id, capability, allowed, locked_by_org) values
          (${roleId}, 'work.sprint.manage', true, true),
          (${roleId}, 'work.project.configure', false, false)`;
      await sql`
        insert into project_role_capabilities (project_id, role_id, capability, allowed)
        values (${projectId}, ${roleId}, 'work.issue.edit', false)`;

      await runner.update({ contexts: ['production'] });
      const org = await sql<{ capability: string; allowed: boolean; locked: boolean }[]>`
        select capability, allowed, locked_by_org as locked from role_capabilities
        where role_id = ${roleId} order by capability`;
      expect(org).toEqual([
        { capability: 'work.automation.edit', allowed: false, locked: false },
        { capability: 'work.project.configure', allowed: false, locked: false },
        { capability: 'work.sprint.complete', allowed: true, locked: true },
        { capability: 'work.sprint.create', allowed: true, locked: true },
        { capability: 'work.sprint.manage', allowed: true, locked: true },
        { capability: 'work.sprint.start', allowed: true, locked: true },
        { capability: 'work.workflow.configure', allowed: false, locked: false },
      ]);
      const overrides = await sql<{ capability: string; allowed: boolean }[]>`
        select capability, allowed from project_role_capabilities
        where project_id = ${projectId} order by capability`;
      expect(overrides).toEqual([
        { capability: 'work.epic.manage', allowed: false },
        { capability: 'work.issue.edit', allowed: false },
      ]);

      await runner.rollback('work', { toId: '0034-work-issue-archiving' });
      const left = await sql<{ capability: string }[]>`
        select capability from role_capabilities where role_id = ${roleId}
        union all
        select capability from project_role_capabilities where project_id = ${projectId}
        order by capability`;
      expect(left.map((row) => row.capability)).toEqual([
        'work.issue.edit',
        'work.project.configure',
        'work.sprint.manage',
      ]);
    } finally {
      await sql.end({ timeout: 5 });
      await database.drop();
    }
  });
});
