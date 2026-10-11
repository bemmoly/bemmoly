import { aiPlanSchema, type AiPlan } from '@bemmoly/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockApi } from '../dispatch.ts';
import { MOCK_STEP_MS } from './ai-plans.ts';

/* The plans mock: the Command mock's request works end to end on the Acme Labs seed. */

const API = 'http://mock.local/api/v1';
type Api = ReturnType<typeof createMockApi>;

const call = (api: Api, method: string, path: string, body?: unknown) =>
  api.dispatch(method, `${API}${path}`, body);
const plan = (body: unknown): AiPlan => aiPlanSchema.parse(body);
const FLAGSHIP = 'move everything blocked by PLT-204 to next sprint';

afterEach(() => vi.useRealTimers());

describe('the plans mock', () => {
  it('plans the flagship request: two moves and a note on each, all allowed', () => {
    const api = createMockApi('ready');
    const created = call(api, 'POST', '/ai/plans', { request: FLAGSHIP });
    expect(created?.status).toBe(201);
    const draft = plan(created?.body);
    expect(draft.summary).toMatch(/Move the 2 issues blocked by PLT-204 from PLT Sprint 14/);
    expect(
      draft.steps.map((step) => [step.preview.target, step.preview.to ?? step.preview.field]),
    ).toEqual([
      ['PLT-211', 'PLT Sprint 15'],
      ['PLT-219', 'PLT Sprint 15'],
      ['PLT-211', 'Comment'],
      ['PLT-219', 'Comment'],
    ]);
    expect(draft.steps.every((step) => step.permission === 'ALLOWED')).toBe(true);
    expect(draft.runnable).toBe(true);
  });

  it('runs a step per read, announces each, and undoes them', () => {
    const api = createMockApi('ready');
    vi.useFakeTimers();
    const draft = plan(call(api, 'POST', '/ai/plans', { request: FLAGSHIP })?.body);
    const queued = plan(
      call(api, 'POST', `/ai/plans/${draft.id}/run`, { steps: [0, 1, 2, 3] })?.body,
    );
    expect(queued.steps.map((step) => step.status)).toEqual([
      'pending',
      'pending',
      'pending',
      'pending',
    ]);
    api.db.outbound.length = 0;
    // The mock's job makes a step every MOCK_STEP_MS, whether or not anyone reads the plan.
    vi.advanceTimersByTime(MOCK_STEP_MS);
    expect(plan(call(api, 'GET', `/ai/plans/${draft.id}`)?.body).status).toBe('running');
    vi.advanceTimersByTime(MOCK_STEP_MS * 4);
    const current = plan(call(api, 'GET', `/ai/plans/${draft.id}`)?.body);
    expect(current.status).toBe('done');
    expect(api.db.outbound.filter(([kind]) => kind === 'ai.plan')).toHaveLength(4);
    for (const key of ['PLT-211', 'PLT-219']) {
      const issue = call(api, 'GET', `/work/issues/${key}`)?.body as { sprint: { name: string } };
      expect(issue.sprint.name).toBe('PLT Sprint 15');
    }
    const comments = call(api, 'GET', '/work/issues/PLT-211/comments')?.body as {
      items: { bodyText: string; aiRunId: string | null }[];
    };
    expect(comments.items.at(-1)?.bodyText).toMatch(/— via Bemmoly for Rohan/);
    expect(comments.items.at(-1)?.aiRunId).toBe(draft.runId);

    const undone = plan(call(api, 'POST', `/ai/plans/${draft.id}/undo`)?.body);
    expect(undone.steps.map((step) => step.status)).toEqual([
      'undone',
      'undone',
      'undone',
      'undone',
    ]);
    const back = call(api, 'GET', '/work/issues/PLT-211')?.body as { sprint: { name: string } };
    expect(back.sprint.name).toBe('PLT Sprint 14');
  });

  it('drafts a preview with actions off and refuses with AI off', () => {
    const api = createMockApi('ready');
    call(api, 'PATCH', '/admin/ai/settings', { privacy: { allowActions: false } });
    const draft = plan(call(api, 'POST', '/ai/plans', { request: FLAGSHIP })?.body);
    expect(draft.runnable).toBe(false);
    expect(call(api, 'POST', `/ai/plans/${draft.id}/run`, {})?.body).toMatchObject({
      details: { reason: 'actions_off' },
    });
    call(api, 'PATCH', '/admin/ai/settings', { privacy: { enabled: false } });
    expect(call(api, 'POST', '/ai/plans', { request: FLAGSHIP })?.body).toMatchObject({
      details: { reason: 'ai_off' },
    });
  });

  it('says honestly when it cannot find a change', () => {
    const api = createMockApi('ready');
    const draft = plan(call(api, 'POST', '/ai/plans', { request: 'make it better' })?.body);
    expect(draft.steps).toEqual([]);
    expect(draft.summary).toMatch(/couldn’t find a change/);
  });
});
