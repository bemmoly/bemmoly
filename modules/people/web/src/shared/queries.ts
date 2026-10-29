import { queryKeys } from '@bemmoly/api-client';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { DirectoryRow } from '../../../shared/index.ts';
import { api } from './api.ts';
import { peopleKeys } from './keys.ts';

/** The signed-in person and what the workspace lets them do. */
export function useSession() {
  const { data } = useQuery({
    queryKey: queryKeys.me(),
    queryFn: () => api.auth.me(),
    staleTime: 60_000,
  });
  const capabilities = useMemo(() => new Set(data?.capabilities ?? []), [data]);
  return {
    userId: data?.user.id ?? null,
    can: (capability: string) => capabilities.has(capability),
  };
}

export function useDirectory(query: Parameters<typeof api.people.directory>[0] = {}) {
  return useQuery({
    queryKey: peopleKeys.directory(query),
    queryFn: async () => (await api.people.directory(query)).items,
  });
}

/** Everyone, left included, by user id: names beside the ids other lists carry. */
export function usePeopleById() {
  const everyone = useDirectory({ includeLeft: true });
  return useMemo(() => {
    const byId = new Map<string, DirectoryRow>((everyone.data ?? []).map((p) => [p.userId, p]));
    return { byId, name: (id: string | null | undefined) => (id ? byId.get(id)?.name : undefined) };
  }, [everyone.data]);
}

/** Teams, locations, cost centres and levels, with lookups by id. */
export function useOrgLookups() {
  const teams = useQuery({
    queryKey: peopleKeys.teams(),
    queryFn: async () => (await api.teams.list()).items,
    staleTime: 5 * 60_000,
  });
  const locations = useQuery({
    queryKey: peopleKeys.locations(),
    queryFn: async () => (await api.org.locations.list()).items,
    staleTime: 5 * 60_000,
  });
  const costCentres = useQuery({
    queryKey: peopleKeys.costCentres(),
    queryFn: async () => (await api.org.costCentres.list()).items,
    staleTime: 5 * 60_000,
  });
  const levels = useQuery({
    queryKey: peopleKeys.levels(),
    queryFn: async () => (await api.people.levels.list()).items,
    staleTime: 5 * 60_000,
  });
  return useMemo(
    () => ({
      teams: teams.data ?? [],
      locations: locations.data ?? [],
      costCentres: costCentres.data ?? [],
      levels: levels.data ?? [],
      team: (id: string | null) => teams.data?.find((team) => team.id === id) ?? null,
      location: (id: string | null) => locations.data?.find((place) => place.id === id) ?? null,
      costCentre: (id: string | null) => costCentres.data?.find((cc) => cc.id === id) ?? null,
    }),
    [teams.data, locations.data, costCentres.data, levels.data],
  );
}
