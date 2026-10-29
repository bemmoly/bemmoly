import type {
  ApprovalBody,
  ChangesQuery,
  CompareQuery,
  CreatePromotionBody,
  ListPromotionsQuery,
  ListDeploymentsQuery,
  ListReleasesQuery,
  ResumeDeploymentBody,
  PromotionPreviewQuery,
  RollbackBody,
  StreamEvent,
} from '@bemmoly/module-pipelines/shared';
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback } from 'react';
import { shippingKeys } from '../api/shipping.ts';
import { api } from '../lib/api.ts';
import { useStream } from './use-stream.ts';

const PAGE = 50;

/** Promotions, newest first, a keyset page at a time. */
export function usePromotions(query: Partial<ListPromotionsQuery>) {
  return useInfiniteQuery({
    queryKey: shippingKeys.promotions(query),
    queryFn: ({ pageParam }) =>
      api.shipping.promotions({
        limit: PAGE,
        ...query,
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    initialPageParam: '',
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });
}

/** The approvals the person can give now: Releases' inbox and For you's "Waiting for you". */
export function useAwaitingMe() {
  return useQuery({
    queryKey: shippingKeys.promotions({ awaitingMe: true, limit: 50 }),
    queryFn: () => api.shipping.promotions({ awaitingMe: true, limit: 50 }),
  });
}

export function useReleases(query: Partial<ListReleasesQuery>) {
  return useInfiniteQuery({
    queryKey: shippingKeys.releases(query),
    queryFn: ({ pageParam }) =>
      api.shipping.releases({ limit: PAGE, ...query, ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: '',
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });
}

export function useRelease(id: string) {
  return useQuery({
    queryKey: shippingKeys.release(id),
    queryFn: () => api.shipping.release(id),
    staleTime: 10 * 60_000,
  });
}

export function usePromotion(id: string | null) {
  return useQuery({
    queryKey: shippingKeys.promotion(id ?? ''),
    queryFn: () => api.shipping.promotion(id ?? ''),
    enabled: Boolean(id),
  });
}

export function usePreview(query: PromotionPreviewQuery | null) {
  return useQuery({
    queryKey: shippingKeys.preview(query ?? { release: '', to: 'prod' }),
    queryFn: () => api.shipping.preview(query as PromotionPreviewQuery),
    enabled: query !== null,
  });
}

export function useCompare(query: CompareQuery | null) {
  return useQuery({
    queryKey: shippingKeys.compare(query ?? { from: '', to: '' }),
    queryFn: () => api.shipping.compare(query as CompareQuery),
    enabled: query !== null,
    staleTime: 10 * 60_000,
  });
}

export function useChanges(query: ChangesQuery) {
  return useQuery({
    queryKey: shippingKeys.changes(query),
    queryFn: () => api.shipping.changes(query),
    placeholderData: keepPreviousData,
  });
}

export function useDeployments(query: Partial<ListDeploymentsQuery>, enabled = true) {
  return useQuery({
    queryKey: shippingKeys.deployments(query),
    queryFn: () => api.shipping.deployments(query),
    enabled,
  });
}

/** Canary against stable for one deployment while it is in its canary or watch. */
export function useCanary(id: string | null) {
  return useQuery({
    queryKey: shippingKeys.canary(id ?? ''),
    queryFn: () => api.shipping.canary(id ?? ''),
    enabled: Boolean(id),
    refetchInterval: 30_000,
  });
}

/** Every shipping write changes what the lists show; refetch them all once it settles. */
export function useShippingWrites() {
  const client = useQueryClient();
  const settle = () => client.invalidateQueries({ queryKey: shippingKeys.all });
  return {
    request: useMutation({
      mutationFn: (body: CreatePromotionBody) => api.shipping.requestPromotion(body),
      onSettled: settle,
    }),
    decide: useMutation({
      mutationFn: ({ id, body }: { id: string; body: ApprovalBody }) =>
        api.shipping.decide(id, body),
      onSettled: settle,
    }),
    cancel: useMutation({
      mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
        api.shipping.cancelPromotion(id, reason),
      onSettled: settle,
    }),
    overrideFreeze: useMutation({
      mutationFn: ({ id, reason }: { id: string; reason: string }) =>
        api.shipping.overrideFreeze(id, { reason }),
      onSettled: settle,
    }),
    resume: useMutation({
      mutationFn: ({ id, body }: { id: string; body: ResumeDeploymentBody }) =>
        api.shipping.resume(id, body),
      onSettled: settle,
    }),
    rollback: useMutation({
      mutationFn: ({ deployment, body }: { deployment: string; body: RollbackBody }) =>
        api.shipping.rollback(deployment, body),
      onSettled: settle,
    }),
  };
}

/**
 * Live shipping: a promotion or deployment that moved on these topics refetches the shipping
 * reads. Events are invalidations, never patches.
 */
export function useShippingStream(topics: readonly string[]) {
  const client = useQueryClient();
  const onEvent = useCallback(
    (event: StreamEvent) => {
      if (
        event.kind === 'promotion.updated' ||
        event.kind === 'deployment.updated' ||
        event.kind === 'for-you.changed' ||
        event.kind === 'current.updated'
      ) {
        void client.invalidateQueries({ queryKey: shippingKeys.all });
      }
    },
    [client],
  );
  useStream(topics, onEvent);
}
