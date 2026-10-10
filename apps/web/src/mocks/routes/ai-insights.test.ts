import { aiInsightResponseSchema } from '@bemmoly/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockApi } from '../dispatch.ts';
import { MAIN_ISSUE_ID, RFC_PAGE_ID } from '../seed/ai-insights.ts';
import { SPRINT_IDS } from '../seed/work-issues.ts';
import { aiOf } from './ai-state.ts';
import { MOCK_INSIGHT_DELAY_MS } from './ai-insights.ts';

/* The insight mock answers like the cache: pending first, then the Acme Labs canned answer. */

const API = 'http://mock.local/api/v1';
type Api = ReturnType<typeof createMockApi>;
const read = (api: Api, kind: string, id: string) =>
  api.dispatch('GET', `${API}/ai/insights/${kind}/${id}`, undefined);
const attentionShapeOf = (api: Api, base: string) =>
  (
    api.dispatch('GET', `${base}/docs/home/attention`, undefined)?.body as {
      items: { kind: string; findings?: number }[];
    }
  ).items;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('the insights mock', () => {
  it('writes the PLT-204 summary after a moment, with its citations', () => {
    const api = createMockApi('ready');
    const first = aiInsightResponseSchema.parse(read(api, 'issue_summary', MAIN_ISSUE_ID)?.body);
    expect(first.insight.state).toBe('pending');
    vi.advanceTimersByTime(MOCK_INSIGHT_DELAY_MS + 100);
    const ready = aiInsightResponseSchema.parse(read(api, 'issue_summary', MAIN_ISSUE_ID)?.body);
    expect(ready.insight.state).toBe('ready');
    expect(ready.insight.content?.citations.map((c) => c.label)).toContain('PLT-211');
    expect(ready.insight.content?.source.counts).toEqual({ comments: 14, PRs: 2, docs: 1 });
    expect(api.db.outbound.some(([kind]) => kind === 'ai.insight')).toBe(true);
  });

  it('serves the RFC TL;DR, the sprint risk and the brief; Try again refreshes', () => {
    const api = createMockApi('ready');
    for (const [kind, id] of [
      ['page_tldr', RFC_PAGE_ID],
      ['sprint_pulse', SPRINT_IDS.s14],
      ['morning_brief', api.db.signedInAs!],
    ] as const) {
      read(api, kind, id);
    }
    vi.advanceTimersByTime(MOCK_INSIGHT_DELAY_MS + 100);
    const pulse = aiInsightResponseSchema.parse(read(api, 'sprint_pulse', SPRINT_IDS.s14)?.body);
    expect(pulse.insight.kind === 'sprint_pulse' && pulse.insight.content?.output.risk).toBe(
      'at_risk',
    );
    const retry = api.dispatch('POST', `${API}/ai/insights/page_tldr/${RFC_PAGE_ID}/refresh`, null);
    expect(retry?.status).toBe(202);
    expect(aiInsightResponseSchema.parse(retry?.body).insight.state).toBe('refreshing');
  });

  it('records Not useful and refuses everything with AI off', () => {
    const api = createMockApi('ready');
    read(api, 'issue_summary', MAIN_ISSUE_ID);
    vi.advanceTimersByTime(MOCK_INSIGHT_DELAY_MS + 100);
    const { insight } = aiInsightResponseSchema.parse(
      read(api, 'issue_summary', MAIN_ISSUE_ID)?.body,
    );
    const feedback = api.dispatch('PUT', `${API}/ai/insights/${insight.id}/feedback`, {
      feedback: 'not_useful',
    });
    expect(feedback?.status).toBe(204);
    expect(
      aiInsightResponseSchema.parse(read(api, 'issue_summary', MAIN_ISSUE_ID)?.body).insight
        .feedback,
    ).toBe('not_useful');

    aiOf(api.db).settings.privacy.enabled = false;
    const refused = read(api, 'issue_summary', MAIN_ISSUE_ID);
    expect(refused?.status).toBe(403);
    expect((refused?.body as { details: unknown }).details).toEqual({ reason: 'ai_off' });
    expect(attentionShapeOf(api, API).some((item) => item.kind === 'consistency')).toBe(false);
  });

  it("lists the RFC's contradiction in Needs attention for its reviewer", () => {
    const api = createMockApi('ready');
    const jonas = api.db.users.find((user) => user.name.startsWith('Jonas'))!;
    api.db.signedInAs = jonas.id;
    expect(attentionShapeOf(api, API)).toContainEqual(
      expect.objectContaining({ kind: 'consistency', findings: 1 }),
    );
  });
});
