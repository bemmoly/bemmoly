import { isApiError, queryKeys } from '@bemmoly/api-client';
import type { AiProviderErrorDetails } from '@bemmoly/shared';
import type { AiAnswerSource } from '@bemmoly/shared/ai-answers';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../shared/api.ts';

/** Why an answer could not be given, in the words the panel shows. */
export type AskFailure =
  | { kind: 'provider'; provider: string | null; retryAfterSeconds: number | null }
  | { kind: 'budget' }
  | { kind: 'unavailable' }
  | { kind: 'off' }
  | { kind: 'other' };

export type AskState =
  | { phase: 'idle' }
  | { phase: 'thinking'; question: string }
  | { phase: 'streaming'; question: string; sources: AiAnswerSource[]; text: string }
  | {
      phase: 'answered';
      question: string;
      sources: AiAnswerSource[];
      text: string;
      runId: string | null;
    }
  | { phase: 'empty'; question: string }
  | { phase: 'failed'; question: string; failure: AskFailure };

/**
 * Whether to draw "Ask your docs": AI on for this person and an embedding model to search
 * with. Without one the mode is not offered at all; a spent budget still draws the panel so
 * it can say so.
 */
export function useAskDocsOffered(aiEnabled: boolean): boolean {
  const status = useQuery({
    queryKey: queryKeys.ai.status(),
    queryFn: () => api.ai.status(),
    enabled: aiEnabled,
    staleTime: 60_000,
  });
  if (!aiEnabled || !status.data) return false;
  return status.data.enabled && status.data.availableRoles.includes('embedding');
}

function failureOf(error: unknown): AskFailure {
  if (!isApiError(error)) return { kind: 'other' };
  const reason = (error.details as { reason?: string } | undefined)?.reason;
  if (reason === 'budget_reached') return { kind: 'budget' };
  if (reason === 'role_unset') return { kind: 'unavailable' };
  if (reason === 'ai_off' || reason === 'opted_out') return { kind: 'off' };
  return { kind: 'other' };
}

function providerFailure(details: unknown): AskFailure {
  const provider = details as Partial<AiProviderErrorDetails> | undefined;
  if (!provider?.failure) return { kind: 'other' };
  return {
    kind: 'provider',
    provider: provider.provider ?? null,
    retryAfterSeconds: provider.retryAfterSeconds ?? null,
  };
}

/**
 * One question at a time against /api/v1/ai/answers: thinking until the sources arrive, then
 * the text as it streams, then the finished answer, the honest empty answer or a failure. A
 * new question or leaving the page stops the one in flight.
 */
export function useAskDocs() {
  const [state, setState] = useState<AskState>({ phase: 'idle' });
  const [notUseful, setNotUseful] = useState(false);
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => () => inFlight.current?.abort(), []);

  const ask = useCallback(async (raw: string) => {
    const question = raw.trim();
    if (!question) return;
    inFlight.current?.abort();
    const abort = new AbortController();
    inFlight.current = abort;
    const live = () => inFlight.current === abort;
    setNotUseful(false);
    setState({ phase: 'thinking', question });
    let sources: AiAnswerSource[] = [];
    let text = '';
    try {
      for await (const event of api.ai.answers.stream({ question }, abort.signal)) {
        if (!live()) return;
        if (event.type === 'sources') {
          sources = event.sources;
          setState({ phase: 'streaming', question, sources, text });
        } else if (event.type === 'delta') {
          text += event.text;
          setState({ phase: 'streaming', question, sources, text });
        } else if (event.type === 'done') {
          setState(
            event.outcome === 'no_sources'
              ? { phase: 'empty', question }
              : { phase: 'answered', question, sources, text: event.text, runId: event.runId },
          );
          return;
        } else {
          setState({ phase: 'failed', question, failure: providerFailure(event.error.details) });
          return;
        }
      }
      if (live()) setState({ phase: 'failed', question, failure: { kind: 'other' } });
    } catch (error) {
      if (abort.signal.aborted || !live()) return;
      setState({ phase: 'failed', question, failure: failureOf(error) });
    }
  }, []);

  const reset = useCallback(() => {
    inFlight.current?.abort();
    inFlight.current = null;
    setState({ phase: 'idle' });
  }, []);

  /** "Not useful" on the finished answer; shown at once, taken back if the call fails. */
  const rateNotUseful = useCallback(() => {
    if (state.phase !== 'answered' || !state.runId) return;
    setNotUseful(true);
    api.ai.runs.feedback(state.runId, 'not_useful').catch(() => setNotUseful(false));
  }, [state]);

  return { state, ask, reset, notUseful, rateNotUseful };
}
