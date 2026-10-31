import type { AdoptBody, ApplyCopyBody } from '@bemmoly/module-pipelines/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adoptionKeys } from '../api/adoption.ts';
import { pipelinesKeys } from '../api/pipelines.ts';
import { api } from '../lib/api.ts';

/** What adopting an environment's running services would import; reading changes nothing. */
export function useAdoptionPlan(environment: string | null) {
  return useQuery({
    queryKey: adoptionKeys.plan(environment ?? ''),
    queryFn: () => api.adoption.plan(environment ?? ''),
    enabled: Boolean(environment),
    staleTime: 0,
  });
}

/** Adopting refreshes the plan and everything an application shows. */
export function useAdopt(environment: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: AdoptBody) => api.adoption.adopt(environment, body),
    onSettled: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: adoptionKeys.plan(environment) }),
        client.invalidateQueries({ queryKey: [...pipelinesKeys.all] }),
      ]),
  });
}

export function useCopyPlan(to: string, from: string | null, application: string | null) {
  return useQuery({
    queryKey: adoptionKeys.copy(to, from ?? '', application),
    queryFn: () => api.adoption.copyPlan(to, from ?? '', application),
    enabled: Boolean(from),
    staleTime: 0,
  });
}

export function useCopy(to: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: ApplyCopyBody) => api.adoption.copy(to, body),
    onSettled: () => client.invalidateQueries({ queryKey: [...pipelinesKeys.all] }),
  });
}
