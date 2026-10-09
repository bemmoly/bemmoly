import { ValidationError } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Project } from '../../../../shared/projects.ts';
import { startWorkHarness, type HarnessStart, type WorkHarness } from '../int-support.ts';
import { createIssuesService } from '../issues/index.ts';
import type { TransitionGate } from './contract.ts';

/*
 * The org default workflow's "Select for sprint" (Backlog → Selected) gets a
 * validator that wants an estimate and a post-action that hands the issue
 * back to its reporter, the way an admin would set them in the editor.
 */
describe('transitions against Postgres', () => {
  let start: HarnessStart;
  let work: WorkHarness;
  let project: Project;
  let selected: string;

  beforeAll(async () => {
    start = await startWorkHarness();
    if (!start.available) return;
    work = start.harness;
    project = await work.project('FLOW', [work.users.member]);
    await work.sql`
      update workflow_transitions set rules = ${JSON.stringify({
        conditions: [],
        validators: [{ name: 'estimate_set', args: {} }],
        postActions: [{ name: 'assign_to_reporter', args: {} }],
      })}::jsonb
      where name = 'Select for sprint'`;
    const [status] = await work.sql<{ id: string }[]>`
      select id from workflow_statuses where name = 'Selected'`;
    selected = status?.id ?? '';
  });

  afterAll(async () => {
    if (start.available) await work.stop();
  });

  it('leaves the issue where it was when a validator rejects the move', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const issue = await work.issue(project, 'No estimate yet', {
      assigneeId: work.users.member,
    });
    const admin = work.as(work.users.admin);
    const refused = work.services.issues.update(admin, issue.key, { statusId: selected });
    await expect(refused).rejects.toBeInstanceOf(ValidationError);
    await expect(refused).rejects.toMatchObject({
      details: { reasons: ['Add an estimate'] },
    });
    const after = await work.services.issues.get(admin, issue.key);
    expect(after).toMatchObject({ statusId: issue.statusId, assigneeId: work.users.member });
    const history = await work.services.history.list(admin, issue.key, { limit: 50 });
    expect(history.items.map((entry) => entry.field)).toEqual(['created']);
  });

  it('lets the same move set the field its validator asks for', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const issue = await work.issue(project, 'Estimated on the way');
    const admin = work.as(work.users.admin);
    const moved = await work.services.issues.update(admin, issue.key, {
      statusId: selected,
      estimate: 3,
    });
    expect(moved).toMatchObject({ statusId: selected, estimate: 3 });
  });

  it('runs the post-action after the move commits and answers with its result', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const issue = await work.issue(project, 'Ready to select', {
      estimate: 2,
      assigneeId: work.users.member,
    });
    const gate = work.services.workflow.gate;
    const seenByOthers: (string | undefined)[] = [];
    const watching: TransitionGate = {
      ...gate,
      async runPostActions(ctx, row, actions) {
        // A fresh pool connection sees only committed rows.
        const [committed] = await work.sql<{ status_id: string }[]>`
          select status_id from issues where id = ${row.id}`;
        seenByOthers.push(committed?.status_id);
        await gate.runPostActions(ctx, row, actions);
      },
    };
    const realtime: { kind: string; ids: readonly string[] }[] = [];
    const issues = createIssuesService({
      database: work.sql,
      realtime: { publish: async (message) => void realtime.push(message) },
      events: { publish: async () => undefined, subscribe: () => () => undefined },
      workflow: watching,
    });
    const admin = work.as(work.users.admin);
    const moved = await issues.update(admin, issue.key, { statusId: selected });

    expect(seenByOthers).toEqual([selected]);
    expect(moved).toMatchObject({ statusId: selected, assigneeId: work.users.admin });
    // Once for the move, once more for what the post-action changed after it.
    expect(realtime.map((message) => message.kind)).toEqual([
      'work.issue',
      'work.board',
      'work.issue',
      'work.board',
    ]);
    const history = await work.services.history.list(admin, issue.key, { limit: 50 });
    expect(history.items.map((entry) => [entry.field, entry.from, entry.to])).toEqual([
      ['assigneeId', work.users.member, work.users.admin],
      ['statusId', issue.statusId, selected],
      ['created', null, issue.key],
    ]);
  });
});
