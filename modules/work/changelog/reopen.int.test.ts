import {
  createChangelogRunner,
  createSqlClient,
  loadKernelChangelog,
  type SqlClient,
} from '@bemmoly/core';
import {
  createIsolatedDatabase,
  startTestDatabase,
  type TestDatabase,
} from '@bemmoly/core/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import work from '../module.ts';
import { copyWorkflowToProject } from '../server/src/services/workflow/project-copy.ts';

/*
 * 0029 on an install that ran the earlier changesets: the org default and its project copies
 * get Reopen out of each done status, a copy whose Done already leads somewhere keeps its own
 * drawing, a saved draft gets the transition too, and down takes back only what up added.
 */

async function transitionsOf(sql: SqlClient, workflowId: string) {
  return sql<{ from_name: string | null; to_name: string; name: string }[]>`
    select f.name as from_name, t.name as to_name, x.name
    from workflow_transitions x
    left join workflow_statuses f on f.id = x.from_status_id
    join workflow_statuses t on t.id = x.to_status_id
    where x.workflow_id = ${workflowId}
    order by x.position, x.id`;
}

const reopens = (rows: { from_name: string | null; to_name: string; name: string }[]) =>
  rows
    .filter((row) => row.name.startsWith('Reopen'))
    .map((row) => `${row.name}: ${row.from_name}->${row.to_name}`);

const BOTH = ['Reopen: Done->Backlog', "Reopen from Won't do: Won't do->Backlog"];

describe('0029 reopen transitions', () => {
  let server: TestDatabase;

  beforeAll(async () => {
    server = await startTestDatabase();
  });

  afterAll(async () => {
    if (server.available) await server.stop();
  });

  it('adds Reopen where a done status has no way out and takes it back on rollback', async (ctx) => {
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
      const [org] = await sql<{ id: string }[]>`
        select id from workflows where project_id is null`;
      const orgId = (org as { id: string }).id;
      expect(reopens(await transitionsOf(sql, orgId))).toEqual(BOTH);

      await runner.rollback('work', { count: 1 });
      expect(reopens(await transitionsOf(sql, orgId))).toEqual([]);
      const projects = await sql<{ id: string; key: string }[]>`
        insert into projects (key, name) values ('TRP', 'Trips'), ('OWN', 'Own')
        returning id, key`;
      const [trp, own] = [...projects] as [
        { id: string; key: string },
        { id: string; key: string },
      ];
      const copied = await copyWorkflowToProject(sql, trp);
      const drawn = await copyWorkflowToProject(sql, own);
      await sql`
        insert into workflow_transitions (workflow_id, from_status_id, to_status_id, name)
        select ${drawn.id}, f.id, t.id, 'Back to testing'
        from workflow_statuses f, workflow_statuses t
        where f.workflow_id = ${drawn.id} and f.name = 'Done'
          and t.workflow_id = ${drawn.id} and t.name = 'Testing'`;
      const statuses = await sql<{ id: string }[]>`
        select id from workflow_statuses where workflow_id = ${copied.id}`;
      const draft = {
        statuses: statuses.map((status) => ({ id: status.id })),
        transitions: [],
      };
      await sql`
        update workflows set draft = ${JSON.stringify(draft)}::jsonb where id = ${copied.id}`;

      await runner.update({ contexts: ['production'] });
      expect(reopens(await transitionsOf(sql, orgId))).toEqual(BOTH);
      expect(reopens(await transitionsOf(sql, copied.id))).toEqual(BOTH);
      expect(reopens(await transitionsOf(sql, drawn.id))).toEqual(["Reopen: Won't do->Backlog"]);
      const [withDraft] = await sql<{ draft: { transitions: { name: string }[] } }[]>`
        select draft from workflows where id = ${copied.id}`;
      expect(withDraft?.draft.transitions.map((item) => item.name)).toEqual([
        'Reopen',
        "Reopen from Won't do",
      ]);

      await runner.rollback('work', { count: 1 });
      expect(reopens(await transitionsOf(sql, copied.id))).toEqual([]);
      expect(reopens(await transitionsOf(sql, drawn.id))).toEqual([]);
      expect((await transitionsOf(sql, drawn.id)).map((row) => row.name)).toContain(
        'Back to testing',
      );
      const [cleared] = await sql<{ draft: { transitions: unknown[] } }[]>`
        select draft from workflows where id = ${copied.id}`;
      expect(cleared?.draft.transitions).toEqual([]);
    } finally {
      await sql.end({ timeout: 5 });
      await database.drop();
    }
  });
});
