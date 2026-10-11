import { aiRunFeedbackBodySchema, type AiRole } from '@bemmoly/shared';
import { aiAnswerRequestSchema, citedIds, type AiAnswerEvent } from '@bemmoly/shared/ai-answers';
import { currentUser, type MockDb } from '../db.ts';
import { cannedAnswer } from '../seed/ai-answers.ts';
import { fail, ok, type MockResponse, type MockRoute } from '../types.ts';
import { aiEnabledFor, aiOf, isPaused, parse, workspaceAiOn } from './ai-state.ts';

/*
 * POST /api/v1/ai/answers as the server answers it: the same refusals before any byte, then
 * NDJSON events paced like a model writing. A provider whose saved test failed stands in for
 * a provider that is down, so the panel's failure state can be seen without a network.
 */

function refusal(db: MockDb): MockResponse | null {
  const ai = aiOf(db);
  const user = currentUser(db);
  if (!workspaceAiOn(db)) return fail(403, 'forbidden', 'AI is turned off', { reason: 'ai_off' });
  if (!aiEnabledFor(db, user?.id ?? null)) {
    return fail(403, 'forbidden', 'You turned AI off for yourself', { reason: 'opted_out' });
  }
  for (const role of ['embedding', 'standard'] as const satisfies readonly AiRole[]) {
    if (!ai.roles[role]) {
      return fail(403, 'forbidden', `No model is set for the ${role} role`, {
        reason: 'role_unset',
        role,
      });
    }
  }
  if (isPaused(db, 'standard')) {
    return fail(403, 'forbidden', "This month's AI budget is spent", {
      reason: 'budget_reached',
      role: 'standard',
    });
  }
  return null;
}

/** A few words at a time, the way a model's deltas arrive. */
function deltas(text: string): string[] {
  return (
    text.match(/\S+\s*|\s+/g)?.reduce<string[]>((pieces, word, index) => {
      if (index % 3 === 0) pieces.push(word);
      else pieces[pieces.length - 1] += word;
      return pieces;
    }, []) ?? [text]
  );
}

let runs = 0;

function answerEvents(db: MockDb, question: string): AiAnswerEvent[] {
  const canned = cannedAnswer(question);
  if (!canned) {
    return [
      { type: 'sources', sources: [] },
      { type: 'done', outcome: 'no_sources', runId: null, text: '', cited: [] },
    ];
  }
  const sources: AiAnswerEvent = { type: 'sources', sources: canned.sources };
  const ai = aiOf(db);
  const provider = ai.providers.find((entry) => entry.id === ai.roles.standard?.providerId);
  if (provider?.status === 'failed') {
    return [
      sources,
      {
        type: 'error',
        error: {
          code: 'provider_error',
          message: `${provider.name} is not answering`,
          details: {
            failure: 'unavailable',
            provider: provider.name,
            providerMessage: 'Service unavailable',
            retryAfterSeconds: 30,
          },
        },
      },
    ];
  }
  runs += 1;
  const offered = new Set(canned.sources.map((source) => source.id));
  return [
    sources,
    ...deltas(canned.text).map((text): AiAnswerEvent => ({ type: 'delta', text })),
    {
      type: 'done',
      outcome: 'answered',
      runId: `018f0000-0000-7000-8000-${(0xa00000 + runs).toString(16).padStart(12, '0')}`,
      text: canned.text,
      cited: citedIds(canned.text, offered),
    },
  ];
}

export const aiAnswerRoutes: readonly MockRoute[] = [
  {
    method: 'POST',
    pattern: '/api/v1/ai/answers',
    handle(request, db) {
      const body = parse(aiAnswerRequestSchema, request);
      if (body.refused) return body.refused;
      const refused = refusal(db);
      if (refused) return refused;
      const lines = answerEvents(db, body.data.question).map(
        (event) => `${JSON.stringify(event)}\n`,
      );
      return {
        status: 200,
        body: lines.join(''),
        lineDelayMs: 45,
        headers: { 'content-type': 'application/x-ndjson' },
      };
    },
  },
  {
    method: 'PUT',
    pattern: '/api/v1/ai/runs/:id/feedback',
    handle(request) {
      const body = parse(aiRunFeedbackBodySchema, request);
      return body.refused ?? ok();
    },
  },
];
