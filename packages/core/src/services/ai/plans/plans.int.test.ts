import { ForbiddenError, type AiPlan } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startPlanHarness, type PlanHarness } from './int-harness.ts';

let h: PlanHarness | undefined;
let skipped = '';

beforeAll(async () => {
  const started = await startPlanHarness();
  if ('skipped' in started) skipped = started.skipped;
  else h = started;
});

afterAll(async () => {
  await h?.stop();
});

const reasonOf = (error: unknown) =>
  error instanceof ForbiddenError ? (error.details as { reason?: string }).reason : undefined;

/** A member asks to rename one note and delete another; the delete needs an org admin. */
async function draft(harness: PlanHarness, userId: string): Promise<AiPlan> {
  const first = await harness.note('Session cleanup');
  const second = await harness.note('Legacy cookie path');
  harness.ai.queue(
    { toolCalls: [{ toolName: 'notes_get', input: { id: first } }] },
    {
      toolCalls: [
        { toolName: 'notes_rename', input: { id: first, title: 'Session cleanup job' } },
        { toolName: 'notes_delete', input: { id: second } },
        { toolName: 'notes_rename', input: { id: second, title: '' } },
        { toolName: 'work_unknown', input: {} },
      ],
    },
  );
  return harness.plans.service.create(harness.as(userId), {
    request: 'tidy the session notes',
    context: { path: '/notes' },
  });
}

describe('plan → confirm → run', () => {
  it('turns a queued tool-call reply into checked steps', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    const plan = await draft(h, h.users.member);
    // The read ran during planning; the empty title and the unknown tool never became steps.
    expect(plan.steps.map((step) => [step.tool, step.permission])).toEqual([
      ['notes_rename', 'ALLOWED'],
      ['notes_delete', 'DENIED'],
    ]);
    expect(plan.steps[0]?.preview).toMatchObject({
      target: 'Session cleanup',
      from: 'Session cleanup',
      to: 'Session cleanup job',
    });
    expect(plan).toMatchObject({
      status: 'proposed',
      runnable: true,
      request: 'tidy the session notes',
    });
    expect(h.ai.runs.at(-1)).toMatchObject({
      purpose: 'plan',
      role: 'strong',
      promptId: 'ai.plan',
    });
  });

  it('marks a step the person cannot make as DENIED, with the reason', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    const plan = await draft(h, h.users.member);
    expect(plan.steps[1]?.permission).toBe('DENIED');
    expect(plan.steps[1]?.reason).toMatch(/.+/);
    // The same request from an org admin is allowed throughout.
    const admin = await draft(h, h.users.admin);
    expect(admin.steps.map((step) => step.permission)).toEqual(['ALLOWED', 'ALLOWED']);
  });

  it('runs only the allowed steps, in a job, with audit rows and progress', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    const plan = await draft(h, h.users.member);
    const queued = await h.plans.service.run(h.as(h.users.member), plan.id, {});
    expect(queued.status).toBe('approved');
    expect(queued.steps.map((step) => step.status)).toEqual(['pending', 'skipped']);
    expect(h.enqueued).toEqual([
      { name: 'ai.plan.run', payload: { planId: plan.id }, key: `ai-plan:${plan.id}` },
    ]);
    h.realtime.length = 0;
    await h.drain();
    const done = await h.plans.service.get(h.as(h.users.member), plan.id);
    expect(done.status).toBe('done');
    expect(done.steps.map((step) => [step.status, step.undoable])).toEqual([
      ['done', true],
      ['skipped', false],
    ]);
    expect((await h.titles()).slice(-2)).toEqual(['Session cleanup job', 'Legacy cookie path']);
    const audit = await h.sql<{ action: string; actor_kind: string; actor_user_id: string }[]>`
      select action, actor_kind, actor_user_id from audit_log where ai_plan_id = ${plan.id}`;
    expect(audit).toEqual([
      { action: 'ai.plan.step_run', actor_kind: 'ai_plan', actor_user_id: h.users.member },
    ]);
    expect(h.realtime.every((m) => m.kind === 'ai.plan' && m.userId === h?.users.member)).toBe(
      true,
    );
    expect(h.realtime.length).toBeGreaterThanOrEqual(2);
  });

  it('is idempotent by plan and step: a re-delivered job changes nothing twice', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    const plan = await draft(h, h.users.admin);
    await h.plans.service.run(h.as(h.users.admin), plan.id, {});
    await h.drain();
    const once = await h.titles();
    await h.plans.service.execute(plan.id);
    expect(await h.titles()).toEqual(once);
    expect(once.at(-1)).toBe('Legacy cookie path (deleted via Bemmoly for rohan)');
    const rows = await h.sql`select 1 from audit_log where ai_plan_id = ${plan.id}`;
    expect(rows).toHaveLength(2);
    // A second confirm is refused.
    await expect(h.plans.service.run(h.as(h.users.admin), plan.id, {})).rejects.toThrow(/already/);
  });

  it('fails a step that was cut off mid-run instead of repeating it', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    const plan = await draft(h, h.users.admin);
    await h.plans.service.run(h.as(h.users.admin), plan.id, {});
    h.enqueued.length = 0;
    await h.sql`update ai_plan_steps set status = 'running' where plan_id = ${plan.id}`;
    await h.sql`update ai_plans set status = 'running' where id = ${plan.id}`;
    await h.plans.service.execute(plan.id);
    const after = await h.plans.service.get(h.as(h.users.admin), plan.id);
    // The rename is safe to repeat; the delete is not, so the person is asked to check.
    expect(after.steps.map((step) => step.status)).toEqual(['done', 'failed']);
    expect(after.steps[1]?.error).toMatch(/stopped/);
    expect(after.status).toBe('failed');
  });

  it('runs the edited plan and undoes what ran', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    const plan = await draft(h, h.users.admin);
    await h.plans.service.run(h.as(h.users.admin), plan.id, { steps: [0] });
    await h.drain();
    expect((await h.titles()).slice(-2)).toEqual(['Session cleanup job', 'Legacy cookie path']);
    const undone = await h.plans.service.undo(h.as(h.users.admin), plan.id);
    expect(undone.steps.map((step) => step.status)).toEqual(['undone', 'skipped']);
    expect((await h.titles()).slice(-2)).toEqual(['Session cleanup', 'Legacy cookie path']);
  });

  it('cancels a plan before it runs', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    const plan = await draft(h, h.users.admin);
    await h.plans.service.run(h.as(h.users.admin), plan.id, {});
    const cancelled = await h.plans.service.cancel(h.as(h.users.admin), plan.id);
    expect(cancelled.status).toBe('cancelled');
    await h.drain();
    expect(cancelled.steps.every((step) => step.status === 'skipped')).toBe(true);
    expect((await h.plans.service.get(h.as(h.users.admin), plan.id)).status).toBe('cancelled');
  });

  it('keeps plans private to the person who made them', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    const plan = await draft(h, h.users.member);
    await expect(h.plans.service.get(h.as(h.users.admin), plan.id)).rejects.toThrow(/not found/);
  });

  it('with actions off, drafts a preview and refuses to run it', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    h.ai.setPolicy({ allowActions: false });
    try {
      const plan = await draft(h, h.users.admin);
      expect(plan.runnable).toBe(false);
      expect(plan.steps).toHaveLength(2);
      const refused = await h.plans.service.run(h.as(h.users.admin), plan.id, {}).catch((e) => e);
      expect(reasonOf(refused)).toBe('actions_off');
    } finally {
      h.ai.setPolicy({ allowActions: true });
    }
  });

  it('gives a viewer, who may not run AI actions, a preview only', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    const plan = await draft(h, h.users.viewer);
    expect(plan.runnable).toBe(false);
  });

  it('with AI off, refuses to plan and to run', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    const plan = await draft(h, h.users.admin);
    h.ai.setPolicy({ enabled: false });
    try {
      const create = await h.plans.service
        .create(h.as(h.users.admin), { request: 'move everything' })
        .catch((e) => e);
      expect(reasonOf(create)).toBe('ai_off');
      const run = await h.plans.service.run(h.as(h.users.admin), plan.id, {}).catch((e) => e);
      expect(reasonOf(run)).toBe('ai_off');
    } finally {
      h.ai.setPolicy({ enabled: true });
    }
  });
});
