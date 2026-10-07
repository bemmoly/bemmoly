import { queryKeys } from '@bemmoly/api-client';
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { api } from '../lib/api.ts';
import { can, isOrgAdmin } from '../lib/session.ts';

export const meQuery = queryOptions({
  queryKey: queryKeys.me(),
  queryFn: () => api.auth.me(),
  staleTime: 60_000,
  retry: false,
});

export const setupStatusQuery = queryOptions({
  queryKey: queryKeys.setupStatus(),
  queryFn: () => api.setup.status(),
  staleTime: 5 * 60_000,
});

/** The signed-in person; valid under the authenticated layout, which loads it first. */
export function useMe() {
  const me = useSuspenseQuery(meQuery).data;
  return {
    ...me,
    isAdmin: isOrgAdmin(me),
    can: (capability: string) => can(me, capability),
  };
}

export function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () => api.auth.logout(),
    onSettled: async () => {
      queryClient.clear();
      await navigate({ to: '/login' });
    },
  });
}
