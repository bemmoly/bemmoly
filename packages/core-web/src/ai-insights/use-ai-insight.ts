import { isApiError, queryKeys, type Http } from '@bemmoly/api-client';
import { aiInsightEndpoints } from '@bemmoly/api-client/ai-insights';
import type { AiInsightKind, AiInsightOf } from '@bemmoly/shared/ai-insights';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

/** What a card draws: nothing, a skeleton, the failed state, or the content. */
export type AiInsightView = 'hidden' | 'loading' | 'failed' | 'ready';

export interface AiInsightHandle<Kind extends AiInsightKind> {
  view: AiInsightView;
  insight: AiInsightOf<Kind> | undefined;
  /** A newer one is being written; the content shown is the last one. */
  refreshing: boolean;
  /** The honest reason a regeneration failed, when the server gave one. */
  failedDetail: string | null;
  retry(): void;
  markNotUseful(): void;
}

function viewOf(
  shown: boolean,
  errored: boolean,
  insight: { state: string; content: unknown } | undefined,
): AiInsightView {
  if (!shown) return 'hidden';
  if (errored || insight?.state === 'failed') return 'failed';
  if (!insight || insight.state === 'pending') return 'loading';
  return insight.content ? 'ready' : 'hidden';
}

/** While a regeneration runs, read again this often in case no socket announces it. */
const POLL_MS = 2_500;

/**
 * One cached insight for a card. Hidden while AI is off for the person, and whenever the
 * server refuses (AI off, opted out, excluded) or the target is gone: a card never says why
 * AI is missing. Pending and refreshing insights are read again until they land.
 */
export function useAiInsight<Kind extends AiInsightKind>(options: {
  http: Http;
  kind: Kind;
  targetId: string | null | undefined;
  aiEnabled: boolean;
}): AiInsightHandle<Kind> {
  const { http, kind, targetId, aiEnabled } = options;
  const client = useQueryClient();
  const endpoints = useMemo(() => aiInsightEndpoints(http), [http]);
  const key = queryKeys.ai.insight(kind, targetId ?? '');
  const query = useQuery({
    queryKey: key,
    queryFn: () => endpoints.get(kind, targetId!),
    enabled: aiEnabled && Boolean(targetId),
    retry: (count, error) => !(isApiError(error) && error.status < 500) && count < 2,
    refetchInterval: (current) => {
      const state = current.state.data?.state;
      return state === 'pending' || state === 'refreshing' ? POLL_MS : false;
    },
  });
  const retry = useMutation({
    mutationFn: () => endpoints.refresh(kind, targetId!),
    onSuccess: (insight) => client.setQueryData(key, insight),
  });
  const feedback = useMutation({
    mutationFn: (id: string) => endpoints.feedback(id, 'not_useful'),
    onMutate: () => {
      client.setQueryData<AiInsightOf<Kind>>(key, (old) =>
        old ? ({ ...old, feedback: 'not_useful' } as AiInsightOf<Kind>) : old,
      );
    },
  });

  const insight = query.data;
  const refused = isApiError(query.error) && [403, 404, 400].includes(query.error.status);
  return {
    view: viewOf(
      aiEnabled && Boolean(targetId) && !refused,
      query.isError || retry.isError,
      insight,
    ),
    insight,
    refreshing: insight?.state === 'refreshing',
    failedDetail: insight?.state === 'failed' ? insight.error : null,
    retry: () => retry.mutate(),
    markNotUseful: () => {
      if (insight?.id) feedback.mutate(insight.id);
    },
  };
}
