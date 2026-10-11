import { aiRunFeedbackBodySchema, type AiFeedback } from '@bemmoly/shared';
import type { Http } from '../http.ts';
import { enc, validated } from './validate.ts';

/** "Not useful" on any AI card: marks the run, which must be the person's own. */
export function aiRunEndpoints(http: Http) {
  return {
    /** Null takes the mark back. */
    feedback: async (runId: string, feedback: AiFeedback | null) =>
      http.send(`/api/v1/ai/runs/${enc(runId)}/feedback`, {
        method: 'PUT',
        body: validated(aiRunFeedbackBodySchema, { feedback }),
      }),
  };
}
