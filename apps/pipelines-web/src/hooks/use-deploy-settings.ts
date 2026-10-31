import type { SetDeploySettingsBody } from '@bemmoly/module-pipelines/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deploySettingsKeys } from '../api/deploy-settings.ts';
import { api } from '../lib/api.ts';

export function useDeploySettings(application: string) {
  return useQuery({
    queryKey: deploySettingsKeys.list(application),
    queryFn: () => api.deploySettings.list(application),
    enabled: application.length > 0,
  });
}

/** Replacing or clearing one environment's settings refreshes the whole list. */
export function useDeploySettingsWrites(application: string) {
  const client = useQueryClient();
  const settle = () => client.invalidateQueries({ queryKey: deploySettingsKeys.list(application) });
  return {
    set: useMutation({
      mutationFn: ({ environment, body }: { environment: string; body: SetDeploySettingsBody }) =>
        api.deploySettings.set(application, environment, body),
      onSettled: settle,
    }),
    clear: useMutation({
      mutationFn: (environment: string) => api.deploySettings.clear(application, environment),
      onSettled: settle,
    }),
  };
}

/** Which applications follow an environment's default runtime and which choose their own. */
export function useEnvironmentFollowers(environment: string | null) {
  return useQuery({
    queryKey: deploySettingsKeys.followers(environment ?? ''),
    queryFn: () => api.deploySettings.followers(environment ?? ''),
    enabled: Boolean(environment),
  });
}
