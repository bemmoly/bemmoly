import type {
  ApplyLandingZoneBody,
  AttachAccountBody,
  CloudAccount,
  CloudConnection,
  ConnectCloudBody,
  LandingZonePlanBody,
} from '@bemmoly/module-pipelines/shared';
import {
  keepPreviousData,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { pipelinesKeys } from '../api/pipelines.ts';
import { platformKeys } from '../api/platform.ts';
import { useEffect, useRef } from 'react';
import { api } from '../lib/api.ts';
import { useSearchText } from './use-search-state.ts';

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

/**
 * Projects attached to one connection: attach, check again, detach, the registry its runners
 * push to, and the project CI secrets live in. Every write refreshes the connection and its
 * accounts, and environments too, since the projects an environment may choose come from here.
 */
export function useAccountWrites(connection: string) {
  const client = useQueryClient();
  const settle = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: [...platformKeys.all] }),
      client.invalidateQueries({ queryKey: pipelinesKeys.environments() }),
    ]);
  return {
    attach: useMutation({
      mutationFn: (body: AttachAccountBody) => api.platform.attachAccount(connection, body),
      onSettled: settle,
    }),
    recheck: useMutation({
      mutationFn: (accountId: string) => api.platform.recheckAccount(connection, accountId),
      onSettled: settle,
    }),
    detach: useMutation({
      mutationFn: (accountId: string) => api.platform.detachAccount(connection, accountId),
      onSettled: settle,
    }),
    registry: useMutation({
      mutationFn: (registry: string | null) =>
        api.platform.updateConnection(connection, { registry }),
      onSettled: settle,
    }),
    ciAccount: useMutation({
      mutationFn: (ciAccountId: string | null) =>
        api.platform.updateConnection(connection, { ciAccountId }),
      onSettled: settle,
    }),
  };
}

export interface ConnectionAccounts {
  connection: CloudConnection;
  accounts: readonly CloudAccount[];
}

/** Every connection with its accounts, for choosing where an environment deploys. */
export function useAllCloudAccounts(): {
  items: ConnectionAccounts[];
  pending: boolean;
  error: unknown;
} {
  const connections = useConnections();
  const list = connections.data?.items ?? [];
  const accounts = useQueries({
    queries: list.map((connection) => ({
      queryKey: platformKeys.accounts(connection.id),
      queryFn: () => api.platform.accounts(connection.id),
    })),
  });
  return {
    items: list.map((connection, index) => ({
      connection,
      accounts: accounts[index]?.data?.items ?? [],
    })),
    pending: connections.isPending || accounts.some((query) => query.isPending),
    error: connections.error ?? accounts.find((query) => query.error)?.error ?? null,
  };
}

/**
 * A connection just made arrives as ?connection=: its first check runs once, so the card
 * shows whether Bemmoly can reach the cloud before anyone attaches a project.
 */
export function useArrivalCheck(): { connectionId: string; checking: boolean } {
  const [connectionId] = useSearchText('connection');
  const { check } = useCloudWrites();
  const { mutate } = check;
  const checked = useRef<string | null>(null);
  useEffect(() => {
    if (!connectionId || checked.current === connectionId) return;
    checked.current = connectionId;
    mutate(connectionId);
  }, [connectionId, mutate]);
  return { connectionId, checking: check.isPending };
}
