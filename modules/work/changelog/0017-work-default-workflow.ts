import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * The org default workflow is the one the Workflow mock draws: seven statuses
 * and eight transitions, the last an "Any → Close" into Won't do. It is
 * published as version 1 with no draft, so a new project has a workflow before
 * anyone opens the editor. Seeding is skipped when a default already exists,
 * so a restore or a rerun never duplicates it.
 */
const DEFAULT_WORKFLOW_NAME = 'Default';

const STATUSES: ReadonlyArray<readonly [string, 'todo' | 'in_progress' | 'done', string]> = [
  ['Backlog', 'todo', '#8a93a3'],
  ['Selected', 'todo', '#8a93a3'],
  ['In progress', 'in_progress', '#2456c9'],
  ['Code review', 'in_progress', '#8b5cf6'],
  ['Testing', 'in_progress', '#d49a1a'],
  ['Done', 'done', '#2b9b5a'],
  ["Won't do", 'done', '#8a93a3'],
];

/** From, to, name; a null from is the "Any" transition. */
const TRANSITIONS: ReadonlyArray<readonly [string | null, string, string]> = [
  ['Backlog', 'Selected', 'Select for sprint'],
  ['Selected', 'In progress', 'Start work'],
  ['In progress', 'Code review', 'Open PR'],
  ['Code review', 'Testing', 'Approve'],
  ['Code review', 'In progress', 'Request changes'],
  ['Testing', 'Done', 'Pass QA'],
  ['Testing', 'In progress', 'Fail QA'],
  [null, "Won't do", 'Close'],
];

export default changeset({
  id: '0017-work-default-workflow',
  author: 'bemmoly',
  description: 'Seed the org default workflow with the statuses and transitions of the mock',
  contexts: ['*'],
  up: async (ctx) => {
    const existing = await ctx.query<{ id: string }>(sql`
      SELECT id FROM workflows WHERE project_id IS NULL AND name = ${DEFAULT_WORKFLOW_NAME}`);
    if (existing.length > 0) return;
    const [workflow] = await ctx.query<{ id: string }>(sql`
      INSERT INTO workflows (project_id, name, published_version)
      VALUES (NULL, ${DEFAULT_WORKFLOW_NAME}, 1)
      RETURNING id`);
    if (!workflow) throw new Error('The default workflow was not inserted');
    for (const [index, [name, category, color]] of STATUSES.entries()) {
      await ctx.exec(sql`
        INSERT INTO workflow_statuses (workflow_id, name, category, color, position)
        VALUES (${workflow.id}, ${name}, ${category}, ${color}, ${index})`);
    }
    for (const [index, [from, to, name]] of TRANSITIONS.entries()) {
      await ctx.exec(sql`
        INSERT INTO workflow_transitions (workflow_id, from_status_id, to_status_id, name, position)
        SELECT ${workflow.id},
          (SELECT id FROM workflow_statuses
             WHERE workflow_id = ${workflow.id} AND name = ${from}),
          (SELECT id FROM workflow_statuses
             WHERE workflow_id = ${workflow.id} AND name = ${to}),
          ${name}, ${index}`);
    }
  },
  down: async (ctx) => {
    await ctx.exec(sql`
      DELETE FROM workflows WHERE project_id IS NULL AND name = ${DEFAULT_WORKFLOW_NAME}`);
  },
});
