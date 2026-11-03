import type {
  ChangeRequestDetail,
  ChangeRequestOptionsQuery,
  CreateChangeRequestBody,
  ListChangeRequestsQuery,
  RejectChangeRequestBody,
  UpdateChangeRequestBody,
} from '@bemmoly/module-pipelines/shared';
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { changeRequestsKeys } from '../../api/change-requests.ts';
import { rolesKeys } from '../../api/roles.ts';
import { api } from '../../lib/api.ts';
import { useStream } from '../../hooks/use-stream.ts';

const PAGE = 50;

/** One tab of the Changes list, a keyset page at a time; refetched when promotions move. */
export function useChangeRequests(query: Partial<ListChangeRequestsQuery>) {
  const client = useQueryClient();
  useStream(['for-you'], () => {
    void client.invalidateQueries({ queryKey: changeRequestsKeys.all });
  });
  return useInfiniteQuery({
    queryKey: changeRequestsKeys.list(query),
    queryFn: ({ pageParam }) =>
      api.changeRequests.list({
        limit: PAGE,
        ...query,
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    initialPageParam: '',
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });
}

/** One request; polls while its deploy runs so the route moves on screen. */
export function useChangeRequest(number: string) {
  const client = useQueryClient();
  useStream(['for-you'], () => {
    void client.invalidateQueries({ queryKey: changeRequestsKeys.detail(number) });
  });
  return useQuery({
    queryKey: changeRequestsKeys.detail(number),
    queryFn: () => api.changeRequests.detail(number),
    enabled: number.length > 0,
    refetchInterval: (query) =>
      ['approved', 'deploying'].includes(query.state.data?.status ?? '') ? 5_000 : false,
  });
}

export function useChangeRequestOptions(query: Partial<ChangeRequestOptionsQuery> | null) {
  return useQuery({
    queryKey: changeRequestsKeys.options(query ?? {}),
    queryFn: () => api.changeRequests.options(query ?? {}),
    enabled: query !== null,
    placeholderData: keepPreviousData,
  });
}

/** The signed-in person's Pipelines role, or null until the server says. */
export function usePipelinesRole() {
  return useQuery({
    queryKey: rolesKeys.me(),
    queryFn: () => api.roles.me(),
    retry: false,
    staleTime: 60_000,
  });
}

/** Every write on a request; each one leaves the detail in the cache as the server sent it. */
export function useChangeRequestWrites() {
  const client = useQueryClient();
  const settle = (detail: ChangeRequestDetail) => {
    client.setQueryData(changeRequestsKeys.detail(detail.number), detail);
    void client.invalidateQueries({ queryKey: changeRequestsKeys.all });
  };
  return {
    create: useMutation({
      mutationFn: (body: CreateChangeRequestBody) => api.changeRequests.create(body),
      onSuccess: settle,
    }),
    update: useMutation({
      mutationFn: (input: { number: string; body: UpdateChangeRequestBody }) =>
        api.changeRequests.update(input.number, input.body),
      onSuccess: settle,
    }),
    send: useMutation({
      mutationFn: (number: string) => api.changeRequests.send(number),
      onSuccess: settle,
    }),
    approve: useMutation({
      mutationFn: (input: { number: string; note?: string }) =>
        api.changeRequests.approve(input.number, input.note),
      onSuccess: settle,
    }),
    reject: useMutation({
      mutationFn: (input: { number: string; body: RejectChangeRequestBody }) =>
        api.changeRequests.reject(input.number, input.body),
      onSuccess: settle,
    }),
    withdraw: useMutation({
      mutationFn: (input: { number: string; reason?: string }) =>
        api.changeRequests.withdraw(input.number, input.reason),
      onSuccess: settle,
    }),
  };
}
