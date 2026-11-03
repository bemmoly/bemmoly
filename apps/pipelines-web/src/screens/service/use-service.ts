import { topicOf } from '@bemmoly/module-pipelines/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { deliveryKeys } from '../../api/delivery.ts';
import { servicesKeys } from '../../api/services.ts';
import { useStream } from '../../hooks/use-stream.ts';
import { api } from '../../lib/api.ts';

/** The service key from /services/<key>/… on every tab. */
export function useServiceKey(): string {
  const { key = '' } = useParams({ strict: false }) as { key?: string };
  return key;
}

/** One service and the path's environments, kept live by the service's stream topic. */
export function useService(key: string) {
  const client = useQueryClient();
  // Events say what changed; the page reads it again rather than patching from them.
  useStream([topicOf.application(key)], () => {
    void client.invalidateQueries({ queryKey: ['pipelines', 'application', key] });
  });
  return useQuery({
    queryKey: servicesKeys.service(key),
    queryFn: () => api.services.service(key),
    enabled: key.length > 0,
  });
}

export function useServiceVersions(key: string) {
  return useQuery({
    queryKey: servicesKeys.versions(key),
    queryFn: () => api.services.versions(key),
    enabled: key.length > 0,
  });
}

export function useServiceRuns(key: string, limit = 50) {
  return useQuery({
    queryKey: deliveryKeys.runs({ application: key, limit }),
    queryFn: () => api.delivery.runs({ application: key, limit }),
    enabled: key.length > 0,
  });
}
