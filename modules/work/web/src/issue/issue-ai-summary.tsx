import { queryKeys } from '@bemmoly/api-client';
import { AiInsightCard, useAiInsight } from '@bemmoly/core-web/ai-insights';
import { useQuery } from '@tanstack/react-query';
import { api } from '../shared/api.ts';

/** True once the workspace has AI on for this person, read from the shell's cached session. */
export function useAiEnabled(): boolean {
  const { data } = useQuery({
    queryKey: queryKeys.me(),
    queryFn: () => api.auth.me(),
    staleTime: 60_000,
  });
  return data?.workspace.aiEnabled ?? false;
}

/**
 * The issue's AI summary (tech design 11.3), on the page and in the slide-over, only while
 * AI is on: what it stands on, who it waits on, what it blocks, each claim linked to the
 * comment, issue or doc it came from. Without AI it takes no room at all.
 */
export function IssueAiSummary({ issueId, size }: { issueId: string; size: 'page' | 'panel' }) {
  const aiEnabled = useAiEnabled();
  const handle = useAiInsight({
    http: api.http,
    kind: 'issue_summary',
    targetId: issueId,
    aiEnabled,
  });
  return (
    <AiInsightCard
      handle={handle}
      variant={size}
      title="Summary"
      failedLabel="Couldn’t get a summary"
    />
  );
}
