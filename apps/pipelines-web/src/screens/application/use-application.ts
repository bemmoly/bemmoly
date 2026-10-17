import { topicOf } from '@bemmoly/module-pipelines/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { deliveryKeys } from '../../api/delivery.ts';
import { pipelinesKeys } from '../../api/pipelines.ts';
import { shippingKeys } from '../../api/shipping.ts';
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
    queryKey: deliveryKeys.strip(key),
    queryFn: () => api.delivery.environmentStrip(key),
    enabled: application.isSuccess,
  });
  // Events say what changed; the screen reads it again rather than patching from them.
  useStream([topicOf.application(key)], () => {
    void client.invalidateQueries({ queryKey: pipelinesKeys.application(key) });
  });
  return { application, strip };
}

export function useCompare(key: string, fromEnv: string | null, toEnv: string | null) {
  const query = { application: key, fromEnv: fromEnv ?? '', toEnv: toEnv ?? '' };
  return useQuery({
    queryKey: shippingKeys.compare(query),
    queryFn: () => api.shipping.compare(query),
    enabled: Boolean(fromEnv && toEnv),
  });
}

export function useCanary(deploymentId: string | null) {
  return useQuery({
    queryKey: deliveryKeys.canary(deploymentId ?? ''),
    queryFn: () => api.delivery.canary(deploymentId ?? ''),
    enabled: Boolean(deploymentId),
    refetchInterval: 30_000,
  });
}

export function useRecentRuns(key: string, limit = 5) {
  return useQuery({
    queryKey: deliveryKeys.runs({ application: key, limit }),
    queryFn: () => api.delivery.runs({ application: key, limit }),
  });
}
