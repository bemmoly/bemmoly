import { topicOf } from '@bemmoly/module-pipelines/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { pipelinesKeys } from '../../api/pipelines.ts';
import { useStream } from '../../hooks/use-stream.ts';
import { api } from '../../lib/api.ts';

/** One application and its environments, kept live by the application's stream topic. */
export function useApplication(key: string) {
  const client = useQueryClient();
  const application = useQuery({
    queryKey: pipelinesKeys.application(key),
    queryFn: () => api.pipelines.application(key),
  });
  const strip = useQuery({
    queryKey: pipelinesKeys.strip(key),
    queryFn: () => api.pipelines.environmentStrip(key),
    enabled: application.isSuccess,
  });
  // Events say what changed; the screen reads it again rather than patching from them.
  useStream([topicOf.application(key)], () => {
    void client.invalidateQueries({ queryKey: pipelinesKeys.application(key) });
  });
  return { application, strip };
}

export function useCompare(key: string, fromEnv: string | null, toEnv: string | null) {
  return useQuery({
    queryKey: pipelinesKeys.compare(key, fromEnv ?? '', toEnv ?? ''),
    queryFn: () => api.pipelines.compareEnvironments(key, fromEnv ?? '', toEnv ?? ''),
    enabled: Boolean(fromEnv && toEnv),
  });
}

export function useCanary(deploymentId: string | null) {
  return useQuery({
    queryKey: pipelinesKeys.canary(deploymentId ?? ''),
    queryFn: () => api.pipelines.canary(deploymentId ?? ''),
    enabled: Boolean(deploymentId),
    refetchInterval: 30_000,
  });
}

export function useRecentRuns(key: string, limit = 5) {
  return useQuery({
    queryKey: pipelinesKeys.runs({ application: key, limit }),
    queryFn: () => api.pipelines.runs({ application: key, limit }),
  });
}
