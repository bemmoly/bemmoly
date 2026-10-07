import { queryKeys } from '@bemmoly/api-client';
import type { NotificationsPage, UpdateNotificationPreferencesRequest } from '@bemmoly/shared';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.ts';

export const inboxQuery = queryOptions({
  queryKey: queryKeys.notifications.list({ limit: 50 }),
  queryFn: () => api.notifications.list({ limit: 50 }),
});

/** The inbox list (grouped by the server) and its unread count for the top-bar badge. */
export function useInbox() {
  const query = useQuery(inboxQuery);
  return { ...query, items: query.data?.items ?? [], unreadCount: query.data?.unreadCount ?? 0 };
}

function markLocally(page: NotificationsPage | undefined, ids: readonly string[] | 'all') {
  if (!page) return page;
  const items = page.items.map((item) =>
    ids === 'all' || ids.includes(item.id) ? { ...item, read: true } : item,
  );
  return { ...page, items, unreadCount: items.filter((item) => !item.read).length };
}

/** Marking read updates the list at once and reconciles with the server afterwards. */
export function useMarkRead() {
  const queryClient = useQueryClient();
  const key = inboxQuery.queryKey;
  const optimistic = async (ids: readonly string[] | 'all') => {
    await queryClient.cancelQueries({ queryKey: key });
    const previous = queryClient.getQueryData(key);
    queryClient.setQueryData(key, markLocally(previous, ids));
    return { previous };
  };
  const rollback = (_: unknown, __: unknown, context?: { previous?: NotificationsPage }) =>
    queryClient.setQueryData(key, context?.previous);
  const settle = () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
  const markRead = useMutation({
    mutationFn: (id: string) => api.notifications.setRead(id, true),
    onMutate: (id) => optimistic([id]),
    onError: rollback,
    onSettled: settle,
  });
  const readAll = useMutation({
    mutationFn: () => api.notifications.readAll(),
    onMutate: () => optimistic('all'),
    onError: rollback,
    onSettled: settle,
  });
  return { markRead, readAll };
}

export const preferencesQuery = queryOptions({
  queryKey: queryKeys.notifications.preferences(),
  queryFn: () => api.notifications.preferences(),
});

export function useNotificationPreferences() {
  const queryClient = useQueryClient();
  const query = useQuery(preferencesQuery);
  const save = useMutation({
    mutationFn: (body: UpdateNotificationPreferencesRequest) =>
      api.notifications.savePreferences(body),
    onSuccess: (data) => queryClient.setQueryData(preferencesQuery.queryKey, data),
  });
  return { ...query, save };
}
