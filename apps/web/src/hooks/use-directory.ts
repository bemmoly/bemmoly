import { queryKeys } from '@bemmoly/api-client';
import type { User, UserStatus } from '@bemmoly/shared';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api } from '../lib/api.ts';

const LIMIT = 200;

/**
 * The first 200 people, every status. The People screens, the settings counts
 * and ⌘K share it; larger workspaces page through /users from the Users page.
 */
export const directoryQuery = queryOptions({
  queryKey: queryKeys.users.list({ limit: LIMIT }),
  queryFn: () => api.users.list({ limit: LIMIT }),
});

export interface Directory {
  users: User[];
  byId: ReadonlyMap<string, User>;
  counts: Record<UserStatus, number>;
  /** More people exist than the directory holds. */
  truncated: boolean;
}

export function useDirectory(enabled = true) {
  const query = useQuery({ ...directoryQuery, enabled });
  const directory = useMemo<Directory>(() => {
    const users = query.data?.items ?? [];
    const counts: Record<UserStatus, number> = { active: 0, invited: 0, deactivated: 0 };
    for (const user of users) counts[user.status] += 1;
    return {
      users,
      byId: new Map(users.map((user) => [user.id, user])),
      counts,
      truncated: Boolean(query.data?.nextCursor),
    };
  }, [query.data]);
  return { ...query, directory };
}
