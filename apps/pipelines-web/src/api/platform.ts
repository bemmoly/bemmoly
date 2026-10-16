import type { Http } from '@bemmoly/api-client';
import {
  acceptProposalsResultSchema,
  accessDecisionSchema,
  bindingsResponseSchema,
  capacitySchema,
  cloudAccountsResponseSchema,
  connectionsResponseSchema,
  idSchema,
  insightsSchema,
  landingZonePlanSchema,
  policiesResponseSchema,
  proposalsPageSchema,
  poolTokenSchema,
  runnerPoolSchema,
  providersResponseSchema,
  type AcceptProposalsBody,
  type ApplyLandingZoneBody,
  type CapacityQuery,
  type CheckAccessBody,
  type ConnectCloudBody,
  type CreatePoolBody,
  type CreateBindingBody,
  type InsightsQuery,
  type LandingZonePlanBody,
  type ListBindingsQuery,
} from '@bemmoly/module-pipelines/shared';
import { z } from 'zod';
import { toQuery } from './query.ts';

const base = '/api/v1/pipelines';
const created = z.object({ id: idSchema });

/** Platform (access, capacity, clouds) and Insights, under the one key root. */
export const platformKeys = {
  all: ['pipelines', 'platform'] as const,
  bindings: (query: ListBindingsQuery) => ['pipelines', 'platform', 'bindings', query] as const,
  policies: (scope: string) => ['pipelines', 'platform', 'policies', scope] as const,
  capacity: (query: CapacityQuery) => ['pipelines', 'platform', 'capacity', query] as const,
  providers: () => ['pipelines', 'platform', 'providers'] as const,
  connections: () => ['pipelines', 'platform', 'connections'] as const,
  accounts: (connection: string) => ['pipelines', 'platform', 'accounts', connection] as const,
  plan: (connection: string, body: LandingZonePlanBody) =>
    ['pipelines', 'platform', 'plan', connection, body] as const,
  insights: (query: InsightsQuery) => ['pipelines', 'insights', query] as const,
  proposals: () => ['pipelines', 'platform', 'proposals'] as const,
};

export function platformEndpoints(http: Http) {
  return {
    bindings: (query: ListBindingsQuery) =>
      http.request(`${base}/bindings`, bindingsResponseSchema, { query: toQuery(query) }),
    createBinding: (body: CreateBindingBody) =>
      http.request(`${base}/bindings`, z.object({}).passthrough(), { method: 'POST', body }),
    removeBinding: (id: string) => http.send(`${base}/bindings/${id}`, { method: 'DELETE' }),
    policies: (scope: string) =>
      http.request(`${base}/policies`, policiesResponseSchema, { query: toQuery({ scope }) }),
    check: (body: CheckAccessBody) =>
      http.request(`${base}/access/checks`, accessDecisionSchema, { method: 'POST', body }),
    capacity: (query: CapacityQuery) =>
      http.request(`${base}/capacity`, capacitySchema, { query: toQuery(query) }),
    createPool: (body: CreatePoolBody) =>
      http.request(`${base}/pools`, z.object({ pool: runnerPoolSchema, token: poolTokenSchema }), {
        method: 'POST',
        body,
      }),
    rotatePoolToken: (key: string) =>
      http.request(`${base}/pools/${key}/tokens`, poolTokenSchema, { method: 'POST' }),
    providers: () => http.request(`${base}/clouds/providers`, providersResponseSchema),
    connections: () => http.request(`${base}/clouds`, connectionsResponseSchema),
    connect: (body: ConnectCloudBody) =>
      http.request(`${base}/clouds`, created, { method: 'POST', body }),
    checkConnection: (id: string) => http.send(`${base}/clouds/${id}/check`, { method: 'POST' }),
    accounts: (id: string) =>
      http.request(`${base}/clouds/${id}/accounts`, cloudAccountsResponseSchema),
    plan: (id: string, body: LandingZonePlanBody) =>
      http.request(`${base}/clouds/${id}/plan`, landingZonePlanSchema, { method: 'POST', body }),
    apply: (id: string, body: ApplyLandingZoneBody) =>
      http.send(`${base}/clouds/${id}/apply`, { method: 'POST', body }),
    proposals: () =>
      http.request(`${base}/discovery/proposals`, proposalsPageSchema, {
        query: { limit: 200 },
      }),
    acceptProposals: (body: AcceptProposalsBody) =>
      http.request(`${base}/discovery/acceptances`, acceptProposalsResultSchema, {
        method: 'POST',
        body,
      }),
    insights: (query: InsightsQuery) =>
      http.request(`${base}/insights`, insightsSchema, { query: toQuery(query) }),
  };
}
