import { queryKeys } from '@bemmoly/api-client';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { api } from './api.ts';
import { docsKeys } from './keys.ts';

export interface DocsPersonView {
  id: string;
  name: string;
}

/**
 * The people of the workspace, for names beside the owner ids the Docs lists carry. The
 * first hundred are held; an id past them reads as "Someone" rather than a raw id.
 */
export function usePeople() {
  const query = useQuery({
    queryKey: docsKeys.people(),
    queryFn: () => api.users.list({ limit: 100 }),
    staleTime: 5 * 60_000,
  });
  const byId = useMemo(
    () => new Map((query.data?.items ?? []).map((user) => [user.id, user])),
    [query.data],
  );
  const person = useCallback(
    (id: string | null | undefined): DocsPersonView | null => {
      if (!id) return null;
      const user = byId.get(id);
      return { id, name: user?.name ?? 'Someone' };
    },
    [byId],
  );
  return { person, loaded: query.isSuccess };
}

/** The signed-in session: the person, the workspace name and whether AI is set up. */
export function useSession() {
  const { data } = useQuery({
    queryKey: queryKeys.me(),
    queryFn: () => api.auth.me(),
    staleTime: 60_000,
  });
  return {
    user: data?.user ?? null,
    workspaceName: data?.workspace.name ?? null,
  };
}
