import { queryKeys } from '@bemmoly/api-client';
import type { Notification, NotificationsPage } from '@bemmoly/shared';
import { useToast } from '@bemmoly/ui';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.ts';

/** inbox: what needs a look. snoozed: put off until a time. done: dealt with. */
export type InboxView = 'inbox' | 'snoozed' | 'done';

/** The inbox view shares its cache with the sidebar's count and Home's preview. */
export const inboxViewQuery = (view: InboxView) =>
  queryOptions({
    queryKey: queryKeys.notifications.list(view === 'inbox' ? { limit: 50 } : { limit: 50, view }),
    queryFn: () => api.notifications.list(view === 'inbox' ? { limit: 50 } : { limit: 50, view }),
  });

export function useInboxView(view: InboxView) {
  const query = useQuery(inboxViewQuery(view));
  return { ...query, items: query.data?.items ?? [], unreadCount: query.data?.unreadCount ?? 0 };
}

/** The times Snooze offers: a few hours, tomorrow morning, next Monday morning. */
export function snoozeChoices(now = new Date()): { id: string; label: string; until: Date }[] {
  const morning = (days: number) => {
    const at = new Date(now);
    at.setDate(at.getDate() + days);
    at.setHours(9, 0, 0, 0);
    return at;
  };
  const toMonday = (8 - now.getDay()) % 7 || 7;
  return [
    ...(now.getHours() < 17
      ? [{ id: 'later', label: 'Later today', until: new Date(now.getTime() + 3 * 3_600_000) }]
      : []),
    { id: 'tomorrow', label: 'Tomorrow morning', until: morning(1) },
    { id: 'next-week', label: 'Next week', until: morning(toMonday) },
  ];
}

const without = (page: NotificationsPage | undefined, ids: readonly string[]) => {
  if (!page) return page;
  const items = page.items.filter((item) => !ids.includes(item.id));
  return { ...page, items, unreadCount: items.filter((item) => !item.read).length };
};

/**
 * Done and Snooze, each at once and each with Undo for six seconds: the item leaves the list
 * before the server answers, comes back if the server refuses, and Undo puts it back.
 */
export function useTriage(view: InboxView) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const key = inboxViewQuery(view).queryKey;
  const settle = () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
  const patch = useMutation({
    mutationFn: (input: {
      item: Notification;
      body: { done?: boolean; snoozedUntil?: string | null };
    }) => api.notifications.update(input.item.id, input.body),
    onMutate: async ({ item }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      queryClient.setQueryData(key, without(previous, [item.id]));
      return { previous };
    },
    onError: (error, _input, context) => {
      queryClient.setQueryData(key, context?.previous);
      toast.show({ tone: 'danger', title: 'That did not save', body: error.message });
    },
    onSettled: settle,
  });
  const restore = (item: Notification, body: { done?: boolean; snoozedUntil?: string | null }) =>
    void api.notifications.update(item.id, body).then(settle, settle);
  const label = (item: Notification) => item.target.label ?? 'It';

  return {
    pending: patch.isPending,
    done(item: Notification) {
      patch.mutate({ item, body: { done: true } });
      toast.undo({
        title: `${label(item)} marked done`,
        onUndo: () => restore(item, { done: false }),
      });
    },
    snooze(item: Notification, until: Date, choice: string) {
      patch.mutate({ item, body: { snoozedUntil: until.toISOString() } });
      toast.undo({
        title: `${label(item)} snoozed`,
        body: `${choice}, ${until.toLocaleString('en', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`,
        onUndo: () => restore(item, { snoozedUntil: null }),
      });
    },
    /** From the Done or Snoozed view: back into the inbox. */
    toInbox(item: Notification) {
      patch.mutate({ item, body: view === 'done' ? { done: false } : { snoozedUntil: null } });
    },
  };
}
