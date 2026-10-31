import type { Http } from '@bemmoly/api-client';
import {
  adoptionPlanSchema,
  adoptResultSchema,
  copyPlanSchema,
  copyResultSchema,
  type AdoptBody,
  type ApplyCopyBody,
} from '@bemmoly/module-pipelines/shared';

const base = '/api/v1/pipelines';

export const adoptionKeys = {
  plan: (environment: string) => ['pipelines', 'platform', 'adoptions', environment] as const,
  copy: (to: string, from: string, application: string | null) =>
    ['pipelines', 'platform', 'copies', to, from, application ?? ''] as const,
};

/** Adopting an environment's running services, and copying configuration into one. */
export function adoptionEndpoints(http: Http) {
  const at = (environment: string, what: 'adoptions' | 'copies') =>
    `${base}/environments/${encodeURIComponent(environment)}/${what}`;
  return {
    plan: (environment: string) => http.request(at(environment, 'adoptions'), adoptionPlanSchema),
    adopt: (environment: string, body: AdoptBody) =>
      http.request(at(environment, 'adoptions'), adoptResultSchema, { method: 'POST', body }),
    copyPlan: (to: string, from: string, application: string | null) => {
      const query = new URLSearchParams({
        from,
        ...(application ? { applications: application } : {}),
      });
      return http.request(`${at(to, 'copies')}?${query.toString()}`, copyPlanSchema);
    },
    copy: (to: string, body: ApplyCopyBody) =>
      http.request(at(to, 'copies'), copyResultSchema, { method: 'POST', body }),
  };
}
