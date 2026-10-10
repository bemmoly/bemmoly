import { queryKeys } from '@bemmoly/api-client';
import { AiSummary } from '@bemmoly/ui';
import { useQuery } from '@tanstack/react-query';
import { api } from '../shared/api.ts';

/** True once the workspace has an AI provider, read from the shell's cached session. */
export function useAiEnabled(): boolean {
  const { data } = useQuery({
    queryKey: queryKeys.me(),
    queryFn: () => api.auth.me(),
    staleTime: 60_000,
  });
  return data?.workspace.aiEnabled ?? false;
}

/**
 * The AI summary, in lilac (ADR 0015), only when the workspace has AI turned on. Without AI it
 * takes no room at all: the page never advertises a feature the workspace does not have.
 */
export function IssueAiSummary({ size }: { size: 'page' | 'panel' }) {
  const enabled = useAiEnabled();
  if (!enabled) return null;
  return (
    <AiSummary variant={size} source="not written yet">
      <span className="text-tx-2">
        Issue summaries are not written yet in this version. Until they are, ask Bemmoly about
        this issue from search.
      </span>
    </AiSummary>
  );
}
