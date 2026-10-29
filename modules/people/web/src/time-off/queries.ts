import { useQuery } from '@tanstack/react-query';
import { api } from '../shared/api.ts';
import { peopleKeys } from '../shared/keys.ts';

export function usePolicies() {
  return useQuery({
    queryKey: peopleKeys.policies(),
    queryFn: async () => (await api.people.leave.policies()).items,
  });
}

export function useMyRequests() {
  const query = { scope: 'mine' as const };
  return useQuery({
    queryKey: peopleKeys.requests(query),
    queryFn: async () => (await api.people.leave.requests(query)).items,
  });
}

export function useAbsences(from: string, to: string, teamId?: string) {
  const query = { from, to, ...(teamId ? { teamId } : {}) };
  return useQuery({
    queryKey: peopleKeys.absences(query),
    queryFn: async () => (await api.people.leave.absences(query)).items,
  });
}
