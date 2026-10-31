import type {
  CreateEnvironmentBody,
  SetPathBody,
  Tier,
  UpdateEnvironmentBody,
} from '@bemmoly/module-pipelines/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pipelinesKeys } from '../api/pipelines.ts';
import { platformKeys } from '../api/platform.ts';
import { api } from '../lib/api.ts';

/** The paths sit under the environments key, so one invalidation refreshes both. */
const pathsKey = () => [...pipelinesKeys.environments(), 'paths'] as const;

export function useEnvironments() {
  return useQuery({
    queryKey: pipelinesKeys.environments(),
    queryFn: () => api.pipelines.environments(),
  });
}

export function useEnvironmentPaths() {
  return useQuery({ queryKey: pathsKey(), queryFn: () => api.pipelines.paths() });
}

export const TIERS: readonly Tier[] = [0, 1, 2];

/**
 * Creating, editing and archiving environments, and setting paths. Each write refreshes the
 * environments and paths, and the clouds too: detaching a project is refused while an
 * environment still uses it, so what the Clouds screen offers follows what changed here.
 */
export function useEnvironmentWrites() {
  const client = useQueryClient();
  const settle = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: pipelinesKeys.environments() }),
      client.invalidateQueries({ queryKey: [...platformKeys.all] }),
    ]);
  return {
    create: useMutation({
      mutationFn: (body: CreateEnvironmentBody) => api.environments.create(body),
      onSettled: settle,
    }),
    update: useMutation({
      mutationFn: ({ key, body }: { key: string; body: UpdateEnvironmentBody }) =>
        api.environments.update(key, body),
      onSettled: settle,
    }),
    archive: useMutation({
      mutationFn: (key: string) => api.environments.archive(key),
      onSettled: settle,
    }),
    /** One tier's path, or the same path for every tier when `tiers` names them all. */
    setPath: useMutation({
      mutationFn: ({ tiers, body }: { tiers: readonly Tier[]; body: SetPathBody }) =>
        Promise.all(tiers.map((tier) => api.environments.setPath(tier, body))),
      onSettled: settle,
    }),
  };
}
