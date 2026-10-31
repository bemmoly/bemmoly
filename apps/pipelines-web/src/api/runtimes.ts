import type { Http } from '@bemmoly/api-client';
import {
  applicationRuntimeSchema,
  applicationRuntimesResponseSchema,
  clusterSchema,
  clustersResponseSchema,
  type ClusterBody,
  type SetApplicationRuntimeBody,
} from '@bemmoly/module-pipelines/shared';

const base = '/api/v1/pipelines';

/** Where applications run: each environment's cluster, and each application's runtime. */
export const runtimeKeys = {
  clusters: () => ['pipelines', 'platform', 'clusters'] as const,
  runtimes: (application: string) => ['pipelines', 'runtimes', application] as const,
};

export function runtimeEndpoints(http: Http) {
  return {
    clusters: () => http.request(`${base}/clusters`, clustersResponseSchema),
    /** Created through a managed connection, or attached through an attached one. */
    addCluster: (body: ClusterBody) =>
      http.request(`${base}/clusters`, clusterSchema, { method: 'POST', body }),
    checkCluster: (id: string) =>
      http.request(`${base}/clusters/${id}/check`, clusterSchema, { method: 'POST' }),
    removeCluster: (id: string) => http.send(`${base}/clusters/${id}`, { method: 'DELETE' }),
    runtimes: (application: string) =>
      http.request(
        `${base}/applications/${encodeURIComponent(application)}/runtimes`,
        applicationRuntimesResponseSchema,
      ),
    setRuntime: (application: string, environment: string, body: SetApplicationRuntimeBody) =>
      http.request(
        `${base}/applications/${encodeURIComponent(application)}/runtimes/${encodeURIComponent(environment)}`,
        applicationRuntimeSchema,
        { method: 'PUT', body },
      ),
  };
}
