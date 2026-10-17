import type { Http } from '@bemmoly/api-client';
import {
  canaryAnalysisSchema,
  changesResponseSchema,
  deploymentsPageSchema,
  idSchema,
  promotionPreviewSchema,
  promotionSchema,
  promotionsPageSchema,
  releaseCompareSchema,
  releaseSchema,
  releasesPageSchema,
  trainsResponseSchema,
  type ApprovalBody,
  type ChangesQuery,
  type CompareQuery,
  type CreatePromotionBody,
  type FreezeOverrideBody,
  type ListDeploymentsQuery,
  type ResumeDeploymentBody,
  type ListPromotionsQuery,
  type ListReleasesQuery,
  type PromotionPreviewQuery,
  type RollbackBody,
} from '@bemmoly/module-pipelines/shared';
import { z } from 'zod';
import { toQuery } from './query.ts';

const base = '/api/v1/pipelines';
/** What a write answers with that the screen needs: the id to open or refetch. */
const created = z.object({ id: idSchema });

/** Releases, promotions, trains and What changed?, under the one key root. */
export const shippingKeys = {
  all: ['pipelines', 'shipping'] as const,
  releases: (query: Partial<ListReleasesQuery>) =>
    ['pipelines', 'shipping', 'releases', query] as const,
  release: (id: string) => ['pipelines', 'shipping', 'release', id] as const,
  compare: (query: CompareQuery) => ['pipelines', 'shipping', 'compare', query] as const,
  promotions: (query: Partial<ListPromotionsQuery>) =>
    ['pipelines', 'shipping', 'promotions', query] as const,
  promotion: (id: string) => ['pipelines', 'shipping', 'promotion', id] as const,
  preview: (query: PromotionPreviewQuery) => ['pipelines', 'shipping', 'preview', query] as const,
  trains: () => ['pipelines', 'shipping', 'trains'] as const,
  changes: (query: ChangesQuery) => ['pipelines', 'shipping', 'changes', query] as const,
  deployments: (query: Partial<ListDeploymentsQuery>) =>
    ['pipelines', 'shipping', 'deployments', query] as const,
  canary: (id: string) => ['pipelines', 'shipping', 'canary', id] as const,
};

export function shippingEndpoints(http: Http) {
  return {
    releases: (query: Partial<ListReleasesQuery>) =>
      http.request(`${base}/releases`, releasesPageSchema, { query: toQuery(query) }),
    release: (id: string) => http.request(`${base}/releases/${id}`, releaseSchema),
    compare: (query: CompareQuery) =>
      http.request(`${base}/releases/compare`, releaseCompareSchema, { query: toQuery(query) }),
    promotions: (query: Partial<ListPromotionsQuery>) =>
      http.request(`${base}/promotions`, promotionsPageSchema, { query: toQuery(query) }),
    promotion: (id: string) => http.request(`${base}/promotions/${id}`, promotionSchema),
    preview: (query: PromotionPreviewQuery) =>
      http.request(`${base}/promotions/preview`, promotionPreviewSchema, {
        query: toQuery(query),
      }),
    requestPromotion: (body: CreatePromotionBody) =>
      http.request(`${base}/promotions`, created, { method: 'POST', body, idempotent: true }),
    decide: (id: string, body: ApprovalBody) =>
      http.send(`${base}/promotions/${id}/approvals`, { method: 'POST', body }),
    cancelPromotion: (id: string, reason?: string) =>
      http.send(`${base}/promotions/${id}/cancel`, {
        method: 'POST',
        body: reason ? { reason } : {},
      }),
    trains: () => http.request(`${base}/trains`, trainsResponseSchema),
    changes: (query: ChangesQuery) =>
      http.request(`${base}/changes`, changesResponseSchema, { query: toQuery(query) }),
    rollback: (deployment: string, body: RollbackBody) =>
      http.request(`${base}/deployments/${deployment}/rollback`, created, {
        method: 'POST',
        body,
      }),
    overrideFreeze: (id: string, body: FreezeOverrideBody) =>
      http.send(`${base}/promotions/${id}/freeze-override`, { method: 'POST', body }),
    deployments: (query: Partial<ListDeploymentsQuery>) =>
      http.request(`${base}/deployments`, deploymentsPageSchema, { query: toQuery(query) }),
    canary: (id: string) => http.request(`${base}/deployments/${id}/canary`, canaryAnalysisSchema),
    resume: (id: string, body: ResumeDeploymentBody) =>
      http.send(`${base}/deployments/${id}/resume`, { method: 'POST', body }),
    /** The change records export, opened as a download. */
    changeRecordsUrl: (query: Record<string, string>) =>
      http.url(`${base}/change-records`, { ...query, format: 'csv' }),
  };
}
