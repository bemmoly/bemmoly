import { topicOf } from '@bemmoly/module-pipelines/shared';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { deliveryKeys } from '../../api/delivery.ts';
import { useStream } from '../../hooks/use-stream.ts';
import { api } from '../../lib/api.ts';

/** The person's changes, approvals, teams and on-call in one request, live on their topic. */
export function useForYou(tab: 'in-flight' | 'shipped') {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: deliveryKeys.forYou(tab),
    queryFn: () => api.delivery.forYou(tab),
    placeholderData: keepPreviousData,
  });
  useStream([topicOf.forYou()], () => {
    void client.invalidateQueries({ queryKey: ['pipelines', 'for-you'] });
  });
  return query;
}
