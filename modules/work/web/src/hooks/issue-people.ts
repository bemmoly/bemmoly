import { queryKeys } from '@bemmoly/api-client';
import type { User } from '@bemmoly/shared';
import type { LoadOptions, SelectOption } from '@bemmoly/ui';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { api } from '../shared/api.ts';
import { issueKeys } from './issue-keys.ts';

export interface Person {
  id: string;
  name: string;
  email: string;
}

const UNKNOWN: Person = { id: '', name: 'Someone', email: '' };

/** A person as a picker option: the name, with the email on a second line. */
export const personOption = (user: Pick<User, 'id' | 'name' | 'email'>): SelectOption => ({
  value: user.id,
  label: user.name,
  description: user.email,
});

/**
 * The people of the workspace, for names beside ids (comment authors, history actors) and the
 * person pickers. The first page is held whole; the pickers search the server past it.
 */
export function usePeople() {
  const query = useQuery({
    queryKey: issueKeys.people(),
    queryFn: () => api.users.list({ limit: 100 }),
    staleTime: 5 * 60_000,
  });
  const byId = useMemo(
    () => new Map((query.data?.items ?? []).map((user) => [user.id, user])),
    [query.data],
  );
  const person = useCallback(
    (id: string | null | undefined): Person => (id ? (byId.get(id) ?? UNKNOWN) : UNKNOWN),
    [byId],
  );
  const loadOptions: LoadOptions = useCallback(
    async (q, signal) =>
      (await api.users.list({ q, limit: 20, status: 'active' }, { signal })).items.map(
        personOption,
      ),
    [],
  );
  return { people: query.data?.items ?? [], person, loadOptions };
}

/** The signed-in person, from the shell's cached session. */
export function useViewer(): Person | null {
  const { data } = useQuery({
    queryKey: queryKeys.me(),
    queryFn: () => api.auth.me(),
    staleTime: 60_000,
  });
  return data?.user ?? null;
}
