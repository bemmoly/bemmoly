import { aiAnswerEventSchema, readAnswer, type AiAnswerEvent } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import { createMockApi } from '../dispatch.ts';
import { aiOf } from './ai-state.ts';

/* The answer mock streams canned, cited answers over the Acme Labs seed and refuses as the server does. */

const URL = 'http://mock.local/api/v1/ai/answers';
type Api = ReturnType<typeof createMockApi>;

function ask(api: Api, question: string) {
  const result = api.dispatch('POST', URL, { question });
  const events =
    result?.status === 200
      ? String(result.body)
          .trim()
          .split('\n')
          .map((line) => aiAnswerEventSchema.parse(JSON.parse(line)))
      : [];
  return { result, events };
}

const done = (events: AiAnswerEvent[]) => events.find((event) => event.type === 'done');

describe('the answer mock', () => {
  it('streams a cited answer about the rollback with one unsourced line', () => {
    const { result, events } = ask(createMockApi('ready'), 'How do we roll back the auth cutover?');
    expect(result?.headers?.['content-type']).toBe('application/x-ndjson');
    expect(result?.lineDelayMs).toBeGreaterThan(0);
    expect(events.length).toBeGreaterThan(5);
    const [first] = events;
    expect(first?.type === 'sources' && first.sources.map((source) => source.href)).toContain(
      '/docs/p/018f0000-0000-7000-8000-0000000013ed#rollback',
    );
    const finished = done(events);
    expect(finished).toMatchObject({ outcome: 'answered', cited: ['c1', 'c3', 'c2', 'c4'] });
    const text = finished?.type === 'done' ? finished.text : '';
    const unsourced = readAnswer(text, new Set(['c1', 'c2', 'c3', 'c4']))
      .flatMap((block) => block.sentences)
      .filter((sentence) => sentence.unsourced);
    expect(unsourced.map((sentence) => sentence.text)).toEqual([
      'Most teams flip the flag back within the hour.',
    ]);
  });

  it('says nothing was found for a question the seed cannot answer', () => {
    const { events } = ask(createMockApi('ready'), 'Who won the cup final?');
    expect(events).toEqual([
      { type: 'sources', sources: [] },
      { type: 'done', outcome: 'no_sources', runId: null, text: '', cited: [] },
    ]);
  });

  it('refuses with the reason while AI is off or a role is unset', () => {
    const api = createMockApi('ready');
    aiOf(api.db).settings.privacy.enabled = false;
    expect(ask(api, 'How do we roll back?').result).toMatchObject({
      status: 403,
      body: { details: { reason: 'ai_off' } },
    });
    aiOf(api.db).settings.privacy.enabled = true;
    aiOf(api.db).roles.embedding = null;
    expect(ask(api, 'How do we roll back?').result).toMatchObject({
      status: 403,
      body: { details: { reason: 'role_unset', role: 'embedding' } },
    });
  });

  it('ends with the provider failure when the standard model is down', () => {
    const api = createMockApi('ready');
    const ai = aiOf(api.db);
    const provider = ai.providers.find((entry) => entry.id === ai.roles.standard?.providerId);
    provider!.status = 'failed';
    const { events } = ask(api, 'How do we roll back?');
    expect(events.at(-1)).toMatchObject({
      type: 'error',
      error: { details: { failure: 'unavailable' } },
    });
  });
});
