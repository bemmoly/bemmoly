import { webhookKeys } from '@bemmoly/api-client/webhooks';
import {
  WEBHOOK_DELIVERY_STATUSES,
  type WebhookDelivery,
  type WebhookDeliveryStatus,
} from '@bemmoly/shared/webhooks';
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useMemo } from 'react';
import { toast } from '../lib/toast.ts';
import { webhooksApi } from '../lib/webhooks-api.ts';
import { useSearchParam } from './use-search-param.ts';

const PAGE = 25;

export type DeliveryFilter = WebhookDeliveryStatus | 'all';

export const isDeliveryStatus = (value: string | null): value is WebhookDeliveryStatus =>
  (WEBHOOK_DELIVERY_STATUSES as readonly string[]).includes(value ?? '');

/**
 * A webhook's delivery log: keyset pages, the status filter and the open delivery in the
 * address, and Redeliver, which queues a fresh delivery of the same event.
 */
export function useWebhookDeliveries(webhookId: string) {
  const client = useQueryClient();
  const [statusParam, setStatusParam] = useSearchParam('status');
  const [openId, setOpenId] = useSearchParam('delivery');
  const status: DeliveryFilter = isDeliveryStatus(statusParam) ? statusParam : 'all';
  const log = useInfiniteQuery({
    queryKey: [...webhookKeys.deliveries(webhookId), status],
    queryFn: ({ pageParam }) =>
      webhooksApi.deliveries(webhookId, {
        limit: PAGE,
        ...(status === 'all' ? {} : { status }),
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });
  const deliveries = useMemo(() => log.data?.pages.flatMap((page) => page.items) ?? [], [log.data]);

  const redeliver = useMutation({
    mutationFn: (delivery: WebhookDelivery) =>
      webhooksApi.deliver(webhookId, { kind: 'redelivery', deliveryId: delivery.id }),
    onSuccess: async () => {
      toast('Redelivery queued');
      await client.invalidateQueries({ queryKey: webhookKeys.deliveries(webhookId) });
    },
    onError: (error) => toast(`Couldn't redeliver. ${error.message}`, 'danger'),
  });

  return {
    log,
    deliveries,
    status,
    setStatus: (next: DeliveryFilter) => setStatusParam(next === 'all' ? null : next, true),
    open: deliveries.find((delivery) => delivery.id === openId) ?? null,
    setOpen: (delivery: WebhookDelivery | null) => setOpenId(delivery?.id ?? null),
    redeliver,
  };
}
