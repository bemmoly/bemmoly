import type { ClusterBody, DeployRuntime } from '@bemmoly/module-pipelines/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { runtimeKeys } from '../api/runtimes.ts';
import { api } from '../lib/api.ts';

/** Every environment's cluster; polled while GKE is still creating one. */
export function useClusters() {
  return useQuery({
    queryKey: runtimeKeys.clusters(),
    queryFn: () => api.runtimes.clusters(),
    refetchInterval: (query) =>
      query.state.data?.items.some((cluster) => cluster.status === 'creating') ? 10_000 : false,
  });
}

/**
 * Creating, attaching, checking and forgetting clusters. Each write refreshes the clusters and
 * every application's runtimes, whose problems depend on the environment's cluster.
 */
export function useClusterWrites() {
  const client = useQueryClient();
  const settle = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: runtimeKeys.clusters() }),
      client.invalidateQueries({ queryKey: ['pipelines', 'runtimes'] }),
    ]);
  return {
    add: useMutation({
      mutationFn: (body: ClusterBody) => api.runtimes.addCluster(body),
      onSettled: settle,
    }),
    check: useMutation({
      mutationFn: (id: string) => api.runtimes.checkCluster(id),
      onSettled: settle,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.runtimes.removeCluster(id),
      onSettled: settle,
    }),
  };
}

export function useApplicationRuntimes(application: string) {
  return useQuery({
    queryKey: runtimeKeys.runtimes(application),
    queryFn: () => api.runtimes.runtimes(application),
    enabled: Boolean(application),
  });
}

/** A switch takes effect on the next deploy; null follows the file, then the environment. */
export function useSetRuntime(application: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      environment,
      runtime,
    }: {
      environment: string;
      runtime: DeployRuntime | null;
    }) => api.runtimes.setRuntime(application, environment, { runtime }),
    onSettled: () => client.invalidateQueries({ queryKey: runtimeKeys.runtimes(application) }),
  });
}
