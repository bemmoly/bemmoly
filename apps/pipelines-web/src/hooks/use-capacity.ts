import type {
  CapacityQuery,
  CreatePoolBody,
  StreamEvent,
  UpdatePoolBody,
} from '@bemmoly/module-pipelines/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { platformKeys } from '../api/platform.ts';
import { api } from '../lib/api.ts';
import { useStream } from './use-stream.ts';

/** Capacity for a range: one request, refetched when the dispatcher says it moved. */
export function useCapacity(query: CapacityQuery) {
  const client = useQueryClient();
  const key = platformKeys.capacity(query);
  const onEvent = useCallback(
    (event: StreamEvent) => {
      if (event.kind === 'capacity.updated') {
        void client.invalidateQueries({ queryKey: key });
      }
    },
    [client, key],
  );
  useStream(['capacity'], onEvent);
  return useQuery({
    queryKey: key,
    queryFn: () => api.platform.capacity(query),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
}

export function usePoolWrites() {
  const client = useQueryClient();
  const settle = () => client.invalidateQueries({ queryKey: [...platformKeys.all, 'capacity'] });
  return {
    create: useMutation({
      mutationFn: (body: CreatePoolBody) => api.platform.createPool(body),
      onSettled: settle,
    }),
    update: useMutation({
      mutationFn: ({ key, body }: { key: string; body: UpdatePoolBody }) =>
        api.platform.updatePool(key, body),
      onSettled: settle,
    }),
    rotate: useMutation({ mutationFn: (key: string) => api.platform.rotatePoolToken(key) }),
  };
}
