import {
  aiPlanCreateBodySchema,
  aiPlanRunBodySchema,
  aiPlanSchema,
  type AiPlanCreateBody,
  type AiPlanRunBody,
} from '@bemmoly/shared';
import type { Http } from '../http.ts';
import { enc, validated } from './validate.ts';

const PLANS = '/api/v1/ai/plans';

/**
 * The ⌘K palette's plans: draw one up from a request, read it while it runs (the realtime
 * kind `ai.plan` says when to), run the allowed steps the person kept, cancel, undo.
 */
export function aiPlanEndpoints(http: Http) {
  return {
    create: async (body: AiPlanCreateBody) =>
      http.request(PLANS, aiPlanSchema, {
        method: 'POST',
        body: validated(aiPlanCreateBodySchema, body),
      }),
    get: async (id: string) => http.request(`${PLANS}/${enc(id)}`, aiPlanSchema),
    run: async (id: string, body: AiPlanRunBody = {}) =>
      http.request(`${PLANS}/${enc(id)}/run`, aiPlanSchema, {
        method: 'POST',
        body: validated(aiPlanRunBodySchema, body),
      }),
    cancel: async (id: string) =>
      http.request(`${PLANS}/${enc(id)}/cancel`, aiPlanSchema, { method: 'POST' }),
    undo: async (id: string) =>
      http.request(`${PLANS}/${enc(id)}/undo`, aiPlanSchema, { method: 'POST' }),
  };
}
