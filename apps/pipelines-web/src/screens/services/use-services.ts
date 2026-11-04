import type { ListServicesQuery } from '@bemmoly/module-pipelines/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { servicesKeys } from '../../api/services.ts';
import { api } from '../../lib/api.ts';

/**
 * Every service with what runs where. The list spans every service, so it is read again every
 * half minute rather than on each deploy event, which would refetch it many times a second.
 */
export function useServices(query: ListServicesQuery) {
  return useQuery({
    queryKey: servicesKeys.list(query),
    queryFn: () => api.services.list(query),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}
