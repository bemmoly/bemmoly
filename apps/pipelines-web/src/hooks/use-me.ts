import { queryOptions, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.ts';

/** The signed-in person, from the kernel's session; a 401 sends them to sign-in and back. */
export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: () => api.auth.me(),
  staleTime: 5 * 60_000,
});

export function useMe() {
  return useQuery(meQuery);
}
