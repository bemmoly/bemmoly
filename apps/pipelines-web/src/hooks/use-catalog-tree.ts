import { useQuery } from '@tanstack/react-query';
import { pipelinesKeys } from '../api/pipelines.ts';
import { api } from '../lib/api.ts';

/** Domains for the scope switcher's first level; small and long-lived. */
export function useDomains() {
  return useQuery({
    queryKey: pipelinesKeys.domains(),
    queryFn: () => api.pipelines.domains(),
    staleTime: 5 * 60_000,
  });
}

/** One domain's groups, for the switcher's second level once a domain is chosen. */
export function useGroups(domain: string | null) {
  return useQuery({
    queryKey: pipelinesKeys.groups(domain ?? ''),
    queryFn: () => api.pipelines.groups(domain ?? ''),
    enabled: domain !== null,
    staleTime: 5 * 60_000,
  });
}
