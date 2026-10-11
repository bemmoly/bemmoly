import type { CodeLink, CodeTransitions } from '@bemmoly/module-work/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api } from '../shared/api.ts';
import { workKeys } from '../shared/keys.ts';
import { issueKeys } from './issue-keys.ts';

/** How many commits the Development section lists before "Show all". */
export const COMMITS_SHOWN = 5;

/**
 * The pull requests, branches and commits linked to an issue. It lives under the issue's key,
 * so the realtime event a delivery publishes refreshes it while the page is open.
 */
export function useCodeLinks(key: string) {
  const query = useQuery({
    queryKey: issueKeys.codeLinks(key),
    queryFn: () => api.work.codeLinks.list(key),
  });
  const groups = useMemo(() => {
    const items = query.data ?? [];
    const of = (kind: CodeLink['kind']) => items.filter((link) => link.kind === kind);
    return { pulls: of('pull_request'), branches: of('branch'), commits: of('commit') };
  }, [query.data]);
  return { query, ...groups };
}

/** "1 open, 2 merged": the pull requests' states for the section's hint. */
export function pullSummary(pulls: readonly CodeLink[]): string {
  const order = ['open', 'draft', 'merged', 'closed'] as const;
  return order
    .map((state) => [state, pulls.filter((pull) => pull.state === state).length] as const)
    .filter(([, count]) => count > 0)
    .map(([state, count]) => `${count} ${state}`)
    .join(', ');
}

export const HOST_NAMES: Record<CodeLink['hostKind'], string> = {
  github: 'GitHub',
  gitlab: 'GitLab',
};

const transitionsKey = (projectKey: string) =>
  [...workKeys.project(projectKey), 'code-transitions'] as const;

/** A project's optional moves on pull request changes; each select saves on its own. */
export function useCodeTransitions(projectKey: string | undefined) {
  const client = useQueryClient();
  const key = transitionsKey(projectKey ?? '');
  const query = useQuery({
    queryKey: key,
    queryFn: () => api.work.codeLinks.transitions(projectKey ?? ''),
    enabled: Boolean(projectKey),
  });
  const save = useMutation({
    mutationFn: (body: Partial<CodeTransitions>) =>
      api.work.codeLinks.updateTransitions(projectKey ?? '', body),
    onMutate: async (body) => {
      await client.cancelQueries({ queryKey: key });
      const before = client.getQueryData<CodeTransitions>(key);
      if (before) client.setQueryData<CodeTransitions>(key, { ...before, ...body });
      return { before };
    },
    onError: (_error, _body, context) => {
      if (context?.before) client.setQueryData(key, context.before);
    },
    onSuccess: (saved) => client.setQueryData(key, saved),
  });
  return { query, save };
}
