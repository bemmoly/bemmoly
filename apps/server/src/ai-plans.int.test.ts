import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startBootHarness, type BootHarness, type SignedInApp } from './boot-harness.ts';

/*
 * ⌘K plans on the real boot path: the recorded provider plays the model (a read of PLT-1,
 * then two proposals), Work's registered tools describe and check the steps, the run is a
 * pg-boss job, and the change lands through Work's services with an audit row for the plan.
 */

const recording = {
  replies: {
    'ai.plan': [
      { toolCalls: [{ toolName: 'work_get_issue', input: { key: 'PLT-1' } }] },
      {
        toolCalls: [
          { toolName: 'work_move_to_sprint', input: { key: 'PLT-2', sprintId: null } },
          { toolName: 'work_add_comment', input: { key: 'PLT-2', text: 'Back to the backlog.' } },
        ],
      },
    ],
  },
};

describe('palette plans in the host', () => {
  let harness: BootHarness | undefined;
  let skipReason = '';
  let app: SignedInApp;

  const call = async (method: string, url: string, payload?: unknown) => {
    const response = await app.inject({
      method: method as 'GET',
      url: `/api/v1${url}`,
      ...(payload !== undefined ? { payload: payload as object } : {}),
    });
    return { status: response.statusCode, body: response.body ? response.json() : null };
  };

  beforeAll(async () => {
    const started = await startBootHarness();
    if (!started.available) {
      skipReason = started.reason;
      return;
    }
    harness = started.harness;
    const file = join(mkdtempSync(join(tmpdir(), 'bemmoly-plans-')), 'recording.json');
    writeFileSync(file, JSON.stringify(recording));
    app = await harness.boot('', { BEMMOLY_AI_RECORDING: file });
    await call('POST', '/admin/modules/work/enable', { access: { mode: 'everyone' } });
  });

  afterAll(async () => harness?.stop());

  it('refuses to plan while AI is off', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const refused = await call('POST', '/ai/plans', { request: 'move PLT-2 to the backlog' });
    expect(refused.status).toBe(403);
    expect(refused.body.details).toEqual({ reason: 'ai_off' });
  });

  it('plans, checks, runs in a job and audits, through the Work services', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const project = await call('POST', '/work/projects', { key: 'PLT', name: 'Platform' });
    const types = (await call('GET', '/work/projects/PLT/issue-types')).body.items as {
      id: string;
      key: string;
    }[];
    const typeId = types.find((type) => type.key === 'task')?.id;
    const sprint = await call('POST', '/work/projects/PLT/sprints', { name: 'Sprint 14' });
    const issue = (title: string, extra = {}) =>
      call('POST', '/work/issues', { projectId: project.body.id, typeId, title, ...extra });
    await issue('Session store migration');
    await issue('Session cleanup job', { sprintId: sprint.body.id });

    expect(
      (
        await call('PATCH', '/admin/ai/settings', {
          privacy: { enabled: true, allowActions: true },
        })
      ).status,
    ).toBe(200);
    const created = await call('POST', '/ai/plans', { request: 'move PLT-2 to the backlog' });
    expect(created.status).toBe(201);
    const plan = created.body;
    expect(
      plan.steps.map((step: { tool: string; permission: string; preview: { to: string } }) => [
        step.tool,
        step.permission,
        step.preview.to,
      ]),
    ).toEqual([
      ['work_move_to_sprint', 'ALLOWED', 'Backlog'],
      ['work_add_comment', 'ALLOWED', null],
    ]);
    expect(plan.runnable).toBe(true);
    // Nothing changed yet.
    expect((await call('GET', '/work/issues/PLT-2')).body.sprintId).toBe(sprint.body.id);

    const run = await call('POST', `/ai/plans/${plan.id}/run`, {});
    expect(run.status).toBe(200);
    let status = run.body.status as string;
    for (let i = 0; i < 100 && !['done', 'failed'].includes(status); i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      status = (await call('GET', `/ai/plans/${plan.id}`)).body.status;
    }
    expect(status).toBe('done');
    expect((await call('GET', '/work/issues/PLT-2')).body.sprintId).toBeNull();
    const comments = await call('GET', '/work/issues/PLT-2/comments');
    expect(comments.body.items.at(-1).bodyText).toBe(
      'Back to the backlog. — via Bemmoly for Rohan S.',
    );
    const audit = await call('GET', `/audit-log?targetKind=ai_plan&targetId=${plan.id}`);
    expect(
      audit.body.items.map((row: { action: string; actorKind: string; aiPlanId: string }) => [
        row.action,
        row.actorKind,
        row.aiPlanId,
      ]),
    ).toEqual([
      ['ai.plan.step_run', 'ai_plan', plan.id],
      ['ai.plan.step_run', 'ai_plan', plan.id],
    ]);

    const undone = await call('POST', `/ai/plans/${plan.id}/undo`, {});
    expect(undone.body.steps.map((step: { status: string }) => step.status)).toEqual([
      'undone',
      'undone',
    ]);
    expect((await call('GET', '/work/issues/PLT-2')).body.sprintId).toBe(sprint.body.id);
  });

  it('drafts a preview it never runs with actions off', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    await call('PATCH', '/admin/ai/settings', { privacy: { allowActions: false } });
    const plan = (await call('POST', '/ai/plans', { request: 'move PLT-2 to the backlog' })).body;
    expect(plan.runnable).toBe(false);
    const refused = await call('POST', `/ai/plans/${plan.id}/run`, {});
    expect(refused.status).toBe(403);
    expect(refused.body.details).toEqual({ reason: 'actions_off' });
  });
});
