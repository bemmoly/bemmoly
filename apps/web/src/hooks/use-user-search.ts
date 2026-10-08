import { queryKeys, type UsersFilter } from '@bemmoly/api-client';
import type { User, UserStatus } from '@bemmoly/shared';
import type { LoadOptions, SelectOption } from '@bemmoly/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { api } from '../lib/api.ts';

/** A person picker draws at most this many; the server returns as many per search. */
export const USER_SEARCH_LIMIT = 50;

/** The repeated lookups of one session (typing, deleting, typing again) come from the cache. */
const SEARCH_STALE_MS = 30_000;

export function userOption(user: User): SelectOption {
  return { value: user.id, label: user.name, description: user.email };
}

export interface UserSearchOptions {
  /** Asked of the server. */
  status?: UserStatus;
  /** Statuses dropped after the answer, for a set the API cannot ask for in one go. */
  exclude?: UserStatus;
}

/**
 * Server search for person pickers: `/users?q=` matches name and email. The Select calls it
 * as people type, so a workspace of 500 or 50,000 behaves the same.
 */
export function useUserSearch({ status, exclude }: UserSearchOptions = {}): LoadOptions {
  const queryClient = useQueryClient();
  return useCallback(
    async (query: string) => {
      const q = query.trim();
      const filter: UsersFilter = {
        limit: USER_SEARCH_LIMIT,
        ...(q ? { q } : {}),
        ...(status ? { status } : {}),
      };
      const page = await queryClient.fetchQuery({
        queryKey: queryKeys.users.list(filter),
        queryFn: () => api.users.list(filter),
        staleTime: SEARCH_STALE_MS,
      });
      return page.items.filter((user) => user.status !== exclude).map(userOption);
    },
    [queryClient, status, exclude],
  );
}
