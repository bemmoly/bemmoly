import type {
  ApplySuggestedSetupBody,
  CreateEnvironmentV2Input,
  UpdateEnvironmentV2Input,
} from '@bemmoly/module-pipelines/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { environmentsV2Keys } from '../api/environments-v2.ts';
import { rolesKeys } from '../api/roles.ts';
import { setupKeys } from '../api/setup.ts';
import { api } from '../lib/api.ts';

export interface ReachableProject {
  externalId: string;
  name: string;
  region: string | null;
  ready: boolean;
}

/** Every project Bemmoly can reach, across connected clouds: what an environment can link. */
export function useReachableProjects() {
  return useQuery({
    queryKey: [...environmentsV2Keys.all, 'projects'],
    queryFn: async (): Promise<ReachableProject[]> => {
      const connections = (await api.platform.connections()).items;
      const lists = await Promise.all(
        connections.map(async (connection) =>
          (await api.platform.accounts(connection.id)).items.map((account) => ({
            externalId: account.externalId,
            name: account.name,
            region: connection.region,
            ready: account.status === 'ready',
          })),
        ),
      );
      return lists.flat().sort((a, b) => a.externalId.localeCompare(b.externalId));
    },
  });
}

/** Approval groups; before People and roles serves them, a rule offers the groups it names. */
export function useApprovalGroups() {
  return useQuery({
    queryKey: environmentsV2Keys.groups(),
    queryFn: async () => {
      try {
        return (await api.environmentsV2.approvalGroups()).items.map(({ id, name }) => ({
          id,
          name,
        }));
      } catch {
        const environments = (await api.environmentsV2.list()).items;
        const named = new Map(
          environments.flatMap((e) => e.approvalSteps.map((s) => [s.groupRef.id, s.groupRef.name])),
        );
        return [...named].map(([id, name]) => ({ id, name }));
      }
    },
  });
}

export function useEnvironmentsV2() {
  return useQuery({
    queryKey: environmentsV2Keys.list(),
    queryFn: () => api.environmentsV2.list(),
  });
}

/** Every write refreshes the environments and the checklist that counts them. */
export function useEnvironmentV2Writes() {
  const client = useQueryClient();
  const settle = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: environmentsV2Keys.all }),
      client.invalidateQueries({ queryKey: setupKeys.all }),
      client.invalidateQueries({ queryKey: rolesKeys.all }),
    ]);
  return {
    create: useMutation({
      mutationFn: (body: CreateEnvironmentV2Input) => api.environmentsV2.create(body),
      onSettled: settle,
    }),
    update: useMutation({
      mutationFn: ({ key, body }: { key: string; body: UpdateEnvironmentV2Input }) =>
        api.environmentsV2.update(key, body),
      onSettled: settle,
    }),
    remove: useMutation({
      mutationFn: (key: string) => api.environmentsV2.remove(key),
      onSettled: settle,
    }),
    reorder: useMutation({
      mutationFn: (keys: string[]) => api.environmentsV2.reorder({ keys }),
      onSettled: settle,
    }),
    applySuggested: useMutation({
      mutationFn: (body: ApplySuggestedSetupBody) => api.environmentsV2.applySuggested(body),
      onSettled: settle,
    }),
  };
}
