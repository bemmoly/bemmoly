import {
  aiAnswerEventSchema,
  aiAnswerRequestSchema,
  aiRunFeedbackBodySchema,
  type AiAnswerEvent,
  type AiAnswerRequest,
  type AiFeedback,
} from '@bemmoly/shared';
import type { Http } from '../http.ts';
import { enc, validated } from './validate.ts';

/** "Ask your docs" and ⌘K questions: a streamed, cited answer, and "Not useful" on it. */
export function aiAnswerEndpoints(http: Http) {
  return {
    answers: {
      /**
       * The answer's events as they arrive: sources, text deltas, then done or error. A
       * refusal (AI off, no model, budget spent) throws an ApiError before the first event.
       */
      async *stream(body: AiAnswerRequest, signal?: AbortSignal): AsyncGenerator<AiAnswerEvent> {
        const valid = validated(aiAnswerRequestSchema, body);
        yield* http.lines('/api/v1/ai/answers', aiAnswerEventSchema, {
          method: 'POST',
          body: valid,
          ...(signal ? { signal } : {}),
        });
      },
      /** Marks the answer's run; null takes the mark back. */
      feedback: async (runId: string, feedback: AiFeedback | null) =>
        http.send(`/api/v1/ai/runs/${enc(runId)}/feedback`, {
          method: 'PUT',
          body: validated(aiRunFeedbackBodySchema, { feedback }),
        }),
    },
  };
}
