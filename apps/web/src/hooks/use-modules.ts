import { queryKeys } from '@bemmoly/api-client';
import type { NavEntry } from '@bemmoly/shared';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.ts';

/** Enabled modules granted to this person; the shell's navigation comes from here. */
export const modulesQuery = queryOptions({
  queryKey: queryKeys.modules(),
  queryFn: () => api.modules.list(),
});

export function useModules() {
  return useQuery(modulesQuery);
}

export function useModule(moduleId: string) {
  const query = useModules();
  return { ...query, manifest: query.data?.find((module) => module.id === moduleId) };
}

export function useNavEntries(placement: NavEntry['placement']): NavEntry[] {
  const { data = [] } = useModules();
  return data.flatMap((module) =>
    module.navigation.filter((entry) => entry.placement === placement),
  );
}
