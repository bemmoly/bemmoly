import { type AiFeedback, type AiInsightKind } from '@bemmoly/shared';
import {
  aiInsightFeedbackBodySchema,
  aiInsightResponseSchema,
  type AiInsight,
  type AiInsightOf,
} from '@bemmoly/shared/ai-insights';
import type { Http } from '../http.ts';
import { enc, validated } from './validate.ts';

const INSIGHTS = '/api/v1/ai/insights';

/**
 * Cached AI insights: an issue summary, a page TL;DR, a sprint pulse, the morning brief, a
 * consistency check. A read answers from the cache, stale content marked "refreshing" while
 * a new one is written; the realtime kind `ai.insight` says when to read again. A subpath
 * (`@bemmoly/api-client/ai-insights`), bound to a client's `http`, so the insight schemas load
 * with the lazy screens that show insights and never in the shell's first bundle.
 */
export function aiInsightEndpoints(http: Http) {
  return {
    get: async <Kind extends AiInsightKind>(kind: Kind, targetId: string) => {
      const { insight } = await http.request(
        `${INSIGHTS}/${enc(kind)}/${enc(targetId)}`,
        aiInsightResponseSchema,
      );
      return insight as AiInsightOf<Kind>;
    },
    /** "Try again": a new one even when nothing changed. */
    refresh: async (kind: AiInsightKind, targetId: string): Promise<AiInsight> => {
      const { insight } = await http.request(
        `${INSIGHTS}/${enc(kind)}/${enc(targetId)}/refresh`,
        aiInsightResponseSchema,
        { method: 'POST' },
      );
      return insight;
    },
    /** "Not useful", recorded on the insight and the model run behind it. */
    feedback: async (id: string, feedback: AiFeedback) =>
      http.send(`${INSIGHTS}/${enc(id)}/feedback`, {
        method: 'PUT',
        body: validated(aiInsightFeedbackBodySchema, { feedback }),
      }),
  };
}
