import { queryOptions, useQuery } from '@tanstack/react-query';
import { fetchModules } from '../services/modules.ts';

export const modulesQuery = queryOptions({
  queryKey: ['modules'],
  queryFn: () => fetchModules(),
});

export function useModules() {
  return useQuery(modulesQuery);
}

export function useModule(moduleId: string) {
  const query = useModules();
  return { ...query, manifest: query.data?.find((module) => module.id === moduleId) };
}
