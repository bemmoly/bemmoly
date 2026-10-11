import {
  aiAnswerEventSchema,
  aiAnswerRequestSchema,
  type AiAnswerEvent,
  type AiAnswerRequest,
} from '@bemmoly/shared/ai-answers';
import type { Http } from '../http.ts';
import { validated } from './validate.ts';

/**
 * "Ask your docs" and ⌘K questions: a streamed, cited answer. Not part
 * of createApiClient, so the shell's first load does not carry it; a screen that asks composes
 * it over its client's http.
 */
export function aiAnswerEndpoints(http: Http) {
  return {
    answers: {
      /**
       * The answer's events as they arrive: sources, text deltas, then done or error. A
       * refusal (AI off, no model, budget spent) throws an ApiError before the first event.
       */
      async *stream(body: AiAnswerRequest, signal?: AbortSignal): AsyncGenerator<AiAnswerEvent> {
        yield* http.lines('/api/v1/ai/answers', aiAnswerEventSchema, {
          method: 'POST',
          body: validated(aiAnswerRequestSchema, body),
          ...(signal ? { signal } : {}),
        });
      },
    },
  };
}
