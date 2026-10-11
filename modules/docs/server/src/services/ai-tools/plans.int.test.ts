import {
  aiToolContribution,
  createAiPlansService,
  createAiToolRegistry,
  createAuditRecorder,
  type AiPlansService,
} from '@bemmoly/core';
import { createTestAi, type TestAi } from '@bemmoly/core/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startDocsHarness, type DocsHarness } from '../int-support.ts';
import { docsAiTools } from './index.ts';

let h: DocsHarness | undefined;
let skipped = '';
let ai: TestAi;
let plans: AiPlansService;
let pageId = '';

beforeAll(async () => {
  const started = await startDocsHarness();
  if (!started.available) {
    skipped = started.reason;
    return;
  }
  h = started.harness;
  const space = await h.space('ENG');
  const page = await h.services.pages.create(h.as(h.users.member), {
    spaceId: space.id,
    title: 'Session store rollout',
  });
  pageId = page.id;
  ai = createTestAi();
  ai.addPrompt('ai.plan', {
    role: 'strong',
    system: 'Plan.',
    prompt: '{{request}}',
    outputSchema: null,
  });
  const harness = h;
  const tools = docsAiTools(h.services).map((tool) => ({
    ...aiToolContribution(tool),
    moduleId: 'docs',
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

const proposal = () => ({
  toolCalls: [
    { toolName: 'docs_search_pages', input: { q: 'session' } },
    { toolName: 'docs_add_page_comment', input: { pageId, text: 'Rollout moved a sprint.' } },
  ],
});

describe('Docs tools in a palette plan', () => {
  it('comments on a page as the person, signed, and undoes it', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    ai.queue(proposal());
    const member = h.as(h.users.member);
    const plan = await plans.create(member, { request: 'note the rollout slip on the page' });
    expect(plan.steps.map((step) => [step.tool, step.permission, step.preview.change])).toEqual([
      ['docs_add_page_comment', 'ALLOWED', 'Rollout moved a sprint.'],
    ]);
    await plans.run(member, plan.id, {});
    await plans.execute(plan.id);
    const comments = await h.services.comments.list(member, pageId, {});
    expect(comments.items.at(-1)?.bodyText).toBe('Rollout moved a sprint. — via Bemmoly for mo');
    const undone = await plans.undo(member, plan.id);
    expect(undone.steps[0]?.status).toBe('undone');
    expect((await h.services.comments.list(member, pageId, {})).items).toHaveLength(
      comments.items.length - 1,
    );
  });

  it('denies a viewer the comment and an outsider the page', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    ai.queue(proposal());
    const viewer = await plans.create(h.as(h.users.viewer), { request: 'note it' });
    expect(viewer.steps.map((step) => step.permission)).toEqual(['DENIED']);
    ai.queue(proposal());
    const outsider = await plans.create(h.as(h.users.outsider), { request: 'note it' });
    expect(outsider.steps.map((step) => [step.permission, step.preview.target])).toEqual([
      ['DENIED', ''],
    ]);
  });
});
