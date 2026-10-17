import type {
  ApplyLandingZoneBody,
  ConnectCloudBody,
  LandingZonePlanBody,
} from '@bemmoly/module-pipelines/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformKeys } from '../api/platform.ts';
import { api } from '../lib/api.ts';

export function useProviders() {
  return useQuery({
    queryKey: platformKeys.providers(),
    queryFn: () => api.platform.providers(),
    staleTime: 30 * 60_000,
  });
}

export function useConnections() {
  return useQuery({
    queryKey: platformKeys.connections(),
    queryFn: () => api.platform.connections(),
  });
}

/** A connection's accounts; polled while any is still being created. */
export function useCloudAccounts(connection: string | null, creating = false) {
  return useQuery({
    queryKey: platformKeys.accounts(connection ?? ''),
    queryFn: () => api.platform.accounts(connection ?? ''),
    enabled: Boolean(connection),
    refetchInterval: creating ? 3_000 : false,
  });
}

/** The landing zone preview: what would be created for a layout. Nothing is written. */
export function useLandingZonePlan(connection: string | null, body: LandingZonePlanBody) {
  return useQuery({
    queryKey: platformKeys.plan(connection ?? '', body),
    queryFn: () => api.platform.plan(connection ?? '', body),
    enabled: Boolean(connection),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useCloudWrites() {
  const client = useQueryClient();
  const settle = () => client.invalidateQueries({ queryKey: [...platformKeys.all] });
  return {
    connect: useMutation({
      mutationFn: (body: ConnectCloudBody) => api.platform.connect(body),
      onSettled: settle,
    }),
    check: useMutation({
      mutationFn: (id: string) => api.platform.checkConnection(id),
      onSettled: settle,
    }),
    apply: useMutation({
      mutationFn: ({ id, body }: { id: string; body: ApplyLandingZoneBody }) =>
        api.platform.apply(id, body),
      onSettled: settle,
    }),
  };
}
