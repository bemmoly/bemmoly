import {
  aiToolContribution,
  createAiPlansService,
  createAiToolRegistry,
  createAuditRecorder,
  type AiPlansService,
} from '@bemmoly/core';
import { createTestAi, type TestAi } from '@bemmoly/core/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Workflow } from '../../../../shared/workflows.ts';
import { startWorkHarness, type WorkHarness } from '../int-support.ts';
import { workAiTools } from './index.ts';

/*
 * The admin-only workflow tools in a palette plan: a draft saved and undone, then published.
 * The model is the AI SDK's mock; everything after it is real.
 */

let h: WorkHarness | undefined;
let skipped = '';
let ai: TestAi;
let plans: AiPlansService;
let pltId = '';

beforeAll(async () => {
  const started = await startWorkHarness();
  if (!started.available) {
    skipped = started.reason;
    return;
  }
  h = started.harness;
  pltId = (await h.project('PLT', [h.users.member])).id;
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
    jobs: { enqueue: async (name) => name },
    realtime: { publish: async () => undefined },
    audit: createAuditRecorder(h.sql),
    contextFor: (actor) => harness.context(actor),
  });
});

afterAll(async () => {
  await h?.stop();
});

/** The workflow PLT uses: its own, or the org default. */
async function pltWorkflow(harness: WorkHarness): Promise<Workflow> {
  const all = await harness.services.workflow.list(harness.as(harness.users.admin), pltId);
  const workflow =
    all.find((item) => item.projectId === pltId) ?? all.find((item) => !item.projectId);
  if (!workflow) throw new Error('PLT has no workflow');
  return workflow;
}

describe('Workflow tools in a palette plan', () => {
  it('lets an admin save a workflow draft and undo it, and denies anyone else', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    const admin = h.as(h.users.admin);
    const workflow = await pltWorkflow(h);
    const current = await h.services.workflow.getDraft(admin, workflow.id);
    const [first, ...rest] = current.statuses;
    if (!first) throw new Error('The workflow has no statuses');
    const draft = { ...current, statuses: [{ ...first, name: 'Ready' }, ...rest] };
    const call = {
      toolName: 'work_save_workflow_draft',
      input: { workflowId: workflow.id, draft },
    };

    ai.queue({ toolCalls: [call] });
    const denied = await plans.create(h.as(h.users.member), { request: 'rename To Do to Ready' });
    expect(denied.steps.map((step) => step.permission)).toEqual(['DENIED']);

    ai.queue({ toolCalls: [call] });
    const plan = await plans.create(admin, { request: 'rename To Do to Ready' });
    expect(plan.steps.map((step) => step.permission)).toEqual(['ALLOWED']);
    expect(plan.steps[0]?.preview.to).toContain('Ready');
    await plans.run(admin, plan.id, {});
    await plans.execute(plan.id);
    const saved = await h.services.workflow.get(admin, workflow.id);
    expect(saved.hasDraft).toBe(true);
    expect((await h.services.workflow.getDraft(admin, workflow.id)).statuses[0]?.name).toBe(
      'Ready',
    );

    await plans.undo(admin, plan.id);
    expect((await h.services.workflow.get(admin, workflow.id)).hasDraft).toBe(workflow.hasDraft);
  });

  it('lets an admin publish the saved draft, and denies it with no draft or to anyone else', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    const admin = h.as(h.users.admin);
    const workflow = await pltWorkflow(h);
    const call = {
      toolName: 'work_publish_workflow',
      input: { workflowId: workflow.id, statusMapping: {} },
    };
    if (workflow.hasDraft) await h.services.workflow.discardDraft(admin, workflow.id);

    ai.queue({ toolCalls: [call] });
    const empty = await plans.create(admin, { request: 'publish the workflow' });
    expect(empty.steps.map((step) => step.permission)).toEqual(['DENIED']);
    expect(empty.steps[0]?.reason).toMatch(/no draft/);

    // Renaming keeps every status id, so no issue needs a mapping.
    const current = await h.services.workflow.getDraft(admin, workflow.id);
    const [first, ...rest] = current.statuses;
    if (!first) throw new Error('The workflow has no statuses');
    await h.services.workflow.putDraft(admin, workflow.id, {
      ...current,
      statuses: [{ ...first, name: 'Queued' }, ...rest],
    });

    ai.queue({ toolCalls: [call] });
    const denied = await plans.create(h.as(h.users.member), { request: 'publish the workflow' });
    expect(denied.steps.map((step) => step.permission)).toEqual(['DENIED']);

    ai.queue({ toolCalls: [call] });
    const plan = await plans.create(admin, { request: 'publish the workflow' });
    expect(plan.steps.map((step) => step.permission)).toEqual(['ALLOWED']);
    expect(plan.steps[0]?.preview).toMatchObject({
      change: `Publish version ${workflow.publishedVersion + 1}`,
    });
    expect(plan.steps[0]?.preview.to).toContain('Queued');
    await plans.run(admin, plan.id, {});
    await plans.execute(plan.id);
    expect((await plans.get(admin, plan.id)).steps.map((step) => step.status)).toEqual(['done']);

    const published = await h.services.workflow.get(admin, workflow.id);
    expect(published.publishedVersion).toBe(workflow.publishedVersion + 1);
    expect(published.hasDraft).toBe(false);
    expect(published.statuses.find((status) => status.id === first.id)?.name).toBe('Queued');
  });
});
