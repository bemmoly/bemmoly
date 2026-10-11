import { queryKeys } from '@bemmoly/api-client';
import { useQuery } from '@tanstack/react-query';
import { api } from '../shared/api.ts';
import { collabUser, type CollabUser } from './user.ts';

/** The signed-in person as their cursor shows them to others; null until /me answers. */
export function useCollabUser(): CollabUser | null {
  const me = useQuery({
    queryKey: queryKeys.me(),
    queryFn: () => api.auth.me(),
    select: (response) => collabUser(response.user),
  });
  return me.data ?? null;
}
