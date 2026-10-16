import type {
  CheckAccessBody,
  CreateBindingBody,
  UpdatePolicyBody,
} from '@bemmoly/module-pipelines/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformKeys } from '../api/platform.ts';
import { api } from '../lib/api.ts';

/** Bindings that apply at a scope, inherited ones included, and how many teams own there. */
export function useBindings(scope: string) {
  return useQuery({
    queryKey: platformKeys.bindings({ scope: scope || undefined }),
    queryFn: () => api.platform.bindings({ scope: scope || undefined }),
  });
}

export function usePolicies(scope: string) {
  return useQuery({
    queryKey: platformKeys.policies(scope),
    queryFn: () => api.platform.policies(scope),
  });
}

/** Adding or removing a binding changes what every screen may show: refetch access reads. */
export function useBindingWrites() {
  const client = useQueryClient();
  const settle = () => client.invalidateQueries({ queryKey: [...platformKeys.all, 'bindings'] });
  return {
    create: useMutation({
      mutationFn: (body: CreateBindingBody) => api.platform.createBinding(body),
      onSettled: settle,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.platform.removeBinding(id),
      onSettled: settle,
    }),
  };
}

/** Editing a policy, and the second Platform admin's approval of a waiting Tier 0 change. */
export function usePolicyWrites() {
  const client = useQueryClient();
  const settle = () => client.invalidateQueries({ queryKey: [...platformKeys.all, 'policies'] });
  return {
    update: useMutation({
      mutationFn: ({ id, body }: { id: string; body: UpdatePolicyBody }) =>
        api.platform.updatePolicy(id, body),
      onSettled: settle,
    }),
    approve: useMutation({
      mutationFn: ({ id, version }: { id: string; version: number }) =>
        api.platform.approvePolicyVersion(id, version),
      onSettled: settle,
    }),
  };
}

/** The checker: a question asked on demand, answered with the decision and its trace. */
export function useAccessCheck(body: CheckAccessBody | null) {
  return useQuery({
    queryKey: [...platformKeys.all, 'check', body],
    queryFn: () => api.platform.check(body as CheckAccessBody),
    enabled: body !== null,
    staleTime: 0,
  });
}
