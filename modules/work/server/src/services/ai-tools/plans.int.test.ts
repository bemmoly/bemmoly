import {
  aiToolContribution,
  createAiPlansService,
  createAiToolRegistry,
  createAuditRecorder,
  type AiPlansService,
} from '@bemmoly/core';
import { createTestAi, type TestAi } from '@bemmoly/core/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Issue } from '../../../../shared/issues.ts';
import type { Sprint } from '../../../../shared/sprints.ts';
import { startWorkHarness, type WorkHarness } from '../int-support.ts';
import { workAiTools } from './index.ts';

/*
 * The palette's flagship request against real Work services: "move everything blocked by
 * PLT-204 to next sprint". The model is the AI SDK's mock; everything after it is real.
 */

let h: WorkHarness | undefined;
let skipped = '';
let ai: TestAi;
let plans: AiPlansService;
let jobs: string[] = [];
let sprints: { current: Sprint; next: Sprint };
let issues: { blocker: Issue; first: Issue; second: Issue; foreign: Issue };

beforeAll(async () => {
  const started = await startWorkHarness();
  if (!started.available) {
    skipped = started.reason;
    return;
  }
  h = started.harness;
  const { member, outsider } = h.users;
  const plt = await h.project('PLT', [member]);
  const ops = await h.project('OPS', [outsider]);
  const admin = h.as(h.users.admin);
  sprints = {
    current: await h.services.sprints.create(admin, 'PLT', { name: 'Sprint 14' }),
    next: await h.services.sprints.create(admin, 'PLT', { name: 'Sprint 15' }),
  };
  const blocker = await h.issue(plt, 'Session store migration to Postgres');
  const inSprint = { sprintId: sprints.current.id };
  issues = {
    blocker,
    first: await h.issue(plt, 'Session cleanup background job', inSprint),
    second: await h.issue(plt, 'Remove legacy cookie path from monolith', inSprint),
    foreign: await h.issue(ops, 'Rotate the on-call pager'),
  };
  for (const issue of [issues.first, issues.second]) {
    await h.services.links.create(admin, blocker.key, { targetId: issue.id, kind: 'blocks' });
  }
  ai = createTestAi();
  ai.addPrompt('ai.plan', {
    role: 'strong',
    system: 'Plan.',
    prompt: '{{request}}',
    outputSchema: null,
  });
  const harness = h;
  const tools = workAiTools(h.services).map((tool) => ({
    ...aiToolContribution(tool),
    moduleId: 'work',
  }));
  plans = createAiPlansService({
    sql: h.sql,
    ai: () => ai,
    tools: createAiToolRegistry({ contributions: () => tools }),
    jobs: {
      enqueue: async (name, payload) => {
        jobs.push((payload as { planId: string }).planId);
        return name;
      },
    },
    realtime: { publish: async () => undefined },
    audit: createAuditRecorder(h.sql),
    contextFor: (actor) => harness.context(actor),
  });
});

afterAll(async () => {
  await h?.stop();
});

function queueFlagship() {
  ai.queue(
    { toolCalls: [{ toolName: 'work_get_issue', input: { key: 'PLT-1' } }] },
    { toolCalls: [{ toolName: 'work_list_sprints', input: { key: 'PLT', state: 'future' } }] },
  );
  // The last turn proposes; with no execute on write tools, the loop ends there.
  ai.queue({
    toolCalls: [
      {
        toolName: 'work_move_to_sprint',
        input: { key: issues.first.key, sprintId: sprints.next.id },
      },
      {
        toolName: 'work_move_to_sprint',
        input: { key: issues.second.key, sprintId: sprints.next.id },
      },
      {
        toolName: 'work_add_comment',
        input: { key: issues.first.key, text: 'Moved to Sprint 15: blocked by PLT-1.' },
      },
      {
        toolName: 'work_move_to_sprint',
        input: { key: issues.foreign.key, sprintId: sprints.next.id },
      },
    ],
  });
}

describe('Work tools in a palette plan', () => {
  it('reads PLT-1, proposes the moves and a note, and checks each as the person', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    ai.queue(
      { toolCalls: [{ toolName: 'work_get_issue', input: { key: 'PLT-1' } }] },
      {
        toolCalls: [
          {
            toolName: 'work_move_to_sprint',
            input: { key: issues.first.key, sprintId: sprints.next.id },
          },
          {
            toolName: 'work_move_to_sprint',
            input: { key: issues.foreign.key, sprintId: sprints.next.id },
          },
        ],
      },
    );
    const plan = await plans.create(h.as(h.users.member), {
      request: 'move everything blocked by PLT-1 to next sprint',
    });
    expect(
      plan.steps.map((step) => [
        step.preview.target,
        step.preview.from,
        step.preview.to,
        step.permission,
      ]),
    ).toEqual([
      [issues.first.key, 'Sprint 14', 'Sprint 15', 'ALLOWED'],
      // OPS is not their project: they cannot even read the issue.
      [issues.foreign.key, null, null, 'DENIED'],
    ]);
    // The read went back to the model with the link in plain words.
    const read = JSON.stringify(ai.calls.at(-1)?.prompt);
    expect(read).toContain('blocks');
    expect(read).toContain(issues.first.key);
  });

  it('runs the allowed steps through the Work services, signed and audited', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    queueFlagship();
    const member = h.as(h.users.member);
    const plan = await plans.create(member, {
      request: 'move everything blocked by PLT-1 to next sprint',
    });
    expect(plan.steps.map((step) => step.permission)).toEqual([
      'ALLOWED',
      'ALLOWED',
      'ALLOWED',
      'DENIED',
    ]);
    jobs = [];
    await plans.run(member, plan.id, {});
    expect(jobs).toEqual([plan.id]);
    await plans.execute(plan.id);
    const done = await plans.get(member, plan.id);
    expect(done.steps.map((step) => step.status)).toEqual(['done', 'done', 'done', 'skipped']);
    for (const issue of [issues.first, issues.second]) {
      expect((await h.services.issues.get(member, issue.key)).sprintId).toBe(sprints.next.id);
    }
    expect(
      (await h.services.issues.get(h.as(h.users.admin), issues.foreign.key)).sprintId,
    ).toBeNull();
    const comments = await h.services.comments.list(member, issues.first.key, { limit: 10 });
    expect(comments.items.at(-1)?.bodyText).toBe(
      'Moved to Sprint 15: blocked by PLT-1. — via Bemmoly for mo',
    );
    expect(comments.items.at(-1)?.authorId).toBe(h.users.member);
    const history = await h.sql<{ actor_id: string }[]>`
      select actor_id from issue_history where issue_id = ${issues.first.id} and field = 'sprintId'`;
    expect(history.at(-1)?.actor_id).toBe(h.users.member);
    const audit = await h.sql`select 1 from audit_log where ai_plan_id = ${plan.id}`;
    expect(audit).toHaveLength(3);

    // Undo puts the sprints back and takes the note down.
    const undone = await plans.undo(member, plan.id);
    expect(undone.steps.map((step) => step.status)).toEqual([
      'undone',
      'undone',
      'undone',
      'skipped',
    ]);
    expect((await h.services.issues.get(member, issues.first.key)).sprintId).toBe(
      sprints.current.id,
    );
    const after = await h.services.comments.list(member, issues.first.key, { limit: 10 });
    expect(after.items).toHaveLength(comments.items.length - 1);
  });

  it('denies a status the workflow does not allow from here', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    ai.queue({
      toolCalls: [
        {
          toolName: 'work_change_status',
          input: { key: issues.first.key, statusId: '0199b1a2-7c3d-7e4f-8a5b-6c7d8e9f0a1c' },
        },
        {
          toolName: 'work_assign_issue',
          input: { key: issues.first.key, assigneeId: h.users.member },
        },
      ],
    });
    const plan = await plans.create(h.as(h.users.member), { request: 'take PLT-2 and finish it' });
    expect(plan.steps.map((step) => [step.tool, step.permission])).toEqual([
      ['work_change_status', 'DENIED'],
      ['work_assign_issue', 'ALLOWED'],
    ]);
    expect(plan.steps[0]?.reason).toMatch(/workflow/);
    expect(plan.steps[1]?.preview).toMatchObject({ from: 'Unassigned', to: 'mo' });
  });
});
