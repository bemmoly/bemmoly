import {
  accessDecisionSchema,
  deploymentSchema,
  deploymentsPageSchema,
  logRangeSchema,
  promotionSchema,
  releaseSchema,
  releasesPageSchema,
  runDetailSchema,
  runSummarySchema,
  type AccessAction,
  type CreateRunBody,
  type RegisterReleaseBody,
} from '@bemmoly/module-pipelines/shared';
import { z } from 'zod';
import type { Http } from './http.ts';

/*
 * The Pipelines endpoints bp calls, each parsed with its shared contract. Paths and bodies
 * follow modules/pipelines/shared; nothing here invents a shape the server does not define.
 */

const API = '/api/v1/pipelines';

/** GET /api/v1/me, narrowed to what whoami prints. */
export const meSchema = z.object({
  user: z.object({ id: z.string(), name: z.string(), email: z.string() }),
  modules: z.array(z.string()),
});

export function createPipelinesClient(http: Http) {
  return {
    me: () => http.request('/api/v1/me', meSchema),

    createRun: (body: CreateRunBody) =>
      http.request(`${API}/runs`, runSummarySchema, { method: 'POST', body }),
    run: (id: string) => http.request(`${API}/runs/${encodeURIComponent(id)}`, runDetailSchema),

    logs: (jobId: string, query: { from?: number; tail?: number }) =>
      http.request(`${API}/jobs/${encodeURIComponent(jobId)}/logs`, logRangeSchema, { query }),

    registerRelease: (body: RegisterReleaseBody) =>
      http.request(`${API}/releases`, releaseSchema, { method: 'POST', body }),
    releases: (query: { application: string; q?: string; limit?: number }) =>
      http.request(`${API}/releases`, releasesPageSchema, { query }),

    promote: (body: { release: string; to: string; note?: string }) =>
      http.request(`${API}/promotions`, promotionSchema, { method: 'POST', body }),

    deployments: (query: { application: string; environment: string; limit?: number }) =>
      http.request(`${API}/deployments`, deploymentsPageSchema, { query }),
    rollback: (deploymentId: string, body: { reason?: string; toRelease?: string }) =>
      http.request(
        `${API}/deployments/${encodeURIComponent(deploymentId)}/rollback`,
        deploymentSchema,
        { method: 'POST', body },
      ),

    checkAccess: (body: {
      action: AccessAction;
      application?: string;
      environment?: string;
      user?: string;
    }) => http.request(`${API}/access/checks`, accessDecisionSchema, { method: 'POST', body }),
  };
}

export type PipelinesClient = ReturnType<typeof createPipelinesClient>;
