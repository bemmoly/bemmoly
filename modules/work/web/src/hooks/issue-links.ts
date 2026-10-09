import type { CreateIssueLinkBody } from '@bemmoly/module-work/shared';
import type { LoadOptions } from '@bemmoly/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { api } from '../shared/api.ts';
import { issueKeys } from './issue-keys.ts';

/** Links live on the detail response, so every change reads the issue again. */
export function useIssueLinks(key: string) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: issueKeys.detail(key) });
  const add = useMutation({
    mutationFn: (body: CreateIssueLinkBody) => api.work.issueLinks.create(key, body),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (linkId: string) => api.work.issueLinks.remove(linkId),
    onSuccess: refresh,
  });
  return { add, remove };
}

/** Issues by key or title prefix for the link picker, leaving out the issue itself. */
export function useIssueSuggestions(excludeKey: string): LoadOptions {
  return useCallback(
    async (q, signal) => {
      if (!q.trim()) return [];
      const hits = await api.work.issues.suggest(q.trim(), signal);
      return hits
        .filter((hit) => hit.key !== excludeKey)
        .map((hit) => ({ value: hit.id, label: `${hit.key} ${hit.title}` }));
    },
    [excludeKey],
  );
}
