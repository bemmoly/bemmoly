import { hasErrorCode, queryKeys } from '@bemmoly/api-client';
import type { DevMailbox } from '@bemmoly/shared';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.ts';

/**
 * The dev mailbox exists only while the server uses the `log` email provider
 * and only for people who manage email; a 404 means it is off.
 */
export const devMailboxQuery = queryOptions({
  queryKey: queryKeys.email.devMailbox(),
  queryFn: async (): Promise<DevMailbox | null> => {
    try {
      return await api.email.devMailbox();
    } catch (error) {
      if (hasErrorCode(error, 'not_found') || hasErrorCode(error, 'forbidden')) return null;
      throw error;
    }
  },
  staleTime: 10_000,
});

export function useDevMailbox(enabled = true) {
  const queryClient = useQueryClient();
  const query = useQuery({ ...devMailboxQuery, enabled });
  const clear = useMutation({
    mutationFn: () => api.email.clearDevMailbox(),
    onSuccess: () =>
      queryClient.setQueryData(devMailboxQuery.queryKey, (): DevMailbox => ({ items: [] })),
  });
  return { ...query, enabled: Boolean(query.data), items: query.data?.items ?? [], clear };
}
