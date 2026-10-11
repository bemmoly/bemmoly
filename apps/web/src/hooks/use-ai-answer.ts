import type { AiAnswerOutcome, AiAnswerSource } from '@bemmoly/shared/ai-answers';
import { useEffect, useRef, useState } from 'react';
import { aiProblemOf, type AiProblem } from '../lib/ai-problem.ts';
import { aiAnswerEndpoints } from '@bemmoly/api-client/ai-answers';
import { api } from '../lib/api.ts';
import { toast } from '../lib/toast.ts';

const answers = aiAnswerEndpoints(api.http).answers;

export interface AiAnswerState {
  question: string;
  sources: AiAnswerSource[];
  text: string;
  streaming: boolean;
  outcome: AiAnswerOutcome | null;
  runId: string | null;
  cited: string[];
  problem: AiProblem | null;
}

const EMPTY: AiAnswerState = {
  question: '',
  sources: [],
  text: '',
  streaming: false,
  outcome: null,
  runId: null,
  cited: [],
  problem: null,
};

/**
 * A ⌘K question answered from the person's docs and issues, streamed as it is written, with
 * the sources it cites. Closing the palette or asking again stops the stream.
 */
export function useAiAnswer() {
  const [state, setState] = useState<AiAnswerState | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const ask = async (question: string) => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    let next: AiAnswerState = { ...EMPTY, question, streaming: true };
    const put = (patch: Partial<AiAnswerState>) => {
      next = { ...next, ...patch };
      if (!controller.signal.aborted) setState(next);
    };
    put({});
    try {
      for await (const event of answers.stream({ question }, controller.signal)) {
        if (event.type === 'sources') put({ sources: event.sources });
        else if (event.type === 'delta') put({ text: next.text + event.text });
        else if (event.type === 'done') {
          put({
            text: event.text,
            outcome: event.outcome,
            runId: event.runId,
            cited: event.cited,
            streaming: false,
          });
        } else {
          put({ streaming: false, problem: aiProblemOf(event.error) });
        }
      }
      if (next.streaming) put({ streaming: false });
    } catch (error) {
      if (controller.signal.aborted) return;
      put({ streaming: false, problem: aiProblemOf(error) });
    }
  };

  return {
    answer: state,
    ask: (question: string) => void ask(question),
    notUseful: () => {
      if (!state?.runId) return;
      void api.ai.runs.feedback(state.runId, 'not_useful').then(() => {
        toast('Thanks. That helps tune Bemmoly’s answers.', 'info');
      });
    },
    reset: () => {
      abort.current?.abort();
      setState(null);
    },
  };
}
