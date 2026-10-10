import {
  notificationPatchBodySchema,
  notificationViewSchema,
  type Notification,
  type NotificationPatchResponse,
  type NotificationView,
} from '@bemmoly/shared';
import { emit } from '../db.ts';
import { invalid, notFound, ok, page, type MockRoute } from '../types.ts';

/*
 * The inbox as the server answers it: views over done and snooze, the badge
 * counting the inbox view only, and done/snooze/read changes on one entry. The
 * mock stores entries already grouped, so an entry stands for its whole group.
 */

/**
 * Whether an entry was unread when it was marked done, so undo can make it
 * unread again as the server does. Keyed by the entry object, which lives as
 * long as its mock database.
 */
const unreadBeforeDone = new WeakMap<Notification, boolean>();

function inView(item: Notification, view: NotificationView, now: number): boolean {
  const snoozed = item.snoozedUntil !== null && Date.parse(item.snoozedUntil) > now;
  if (view === 'done') return item.done;
  if (view === 'snoozed') return !item.done && snoozed;
  return !item.done && !snoozed;
}

/** The badge: unread entries in the inbox view only. */
export function inboxUnreadCount(items: readonly Notification[], now = Date.now()): number {
  return items.filter((item) => !item.read && inView(item, 'inbox', now)).length;
}

function applyDone(item: Notification, done: boolean): void {
  if (done && !item.done) {
    unreadBeforeDone.set(item, !item.read);
    item.read = true;
  } else if (!done && item.done) {
    if (unreadBeforeDone.get(item)) item.read = false;
    unreadBeforeDone.delete(item);
  }
  item.done = done;
}

export const notificationRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/notifications',
    handle: (request, db) => {
      const view = notificationViewSchema.safeParse(request.query.get('view') ?? 'inbox');
      if (!view.success) return invalid('view', 'Use inbox, done or snoozed.');
      const unread = request.query.get('unread') === 'true';
      const now = Date.now();
      const items = db.notifications.filter(
        (entry) => inView(entry, view.data, now) && (!unread || !entry.read),
      );
      return ok({ ...page(items, request), unreadCount: inboxUnreadCount(db.notifications, now) });
    },
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/notifications/:id',
    handle: (request, db) => {
      const item = db.notifications.find((entry) => entry.id === request.params['id']);
      if (!item) return notFound('That notification');
      const parsed = notificationPatchBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return invalid(
          'body',
          parsed.error.issues[0]?.message ?? 'Send read, done or snoozedUntil',
        );
      }
      const body = parsed.data;
      const response: NotificationPatchResponse = { ids: item.ids };
      // Done, then snooze, then read: the server's order, so an explicit read wins.
      if (body.done !== undefined) {
        applyDone(item, body.done);
        response.done = body.done;
        if (body.done) response.read = true;
      }
      if (body.snoozedUntil !== undefined) {
        item.snoozedUntil =
          body.snoozedUntil === null ? null : new Date(body.snoozedUntil).toISOString();
        if (item.snoozedUntil) item.read = false;
        response.snoozedUntil = item.snoozedUntil;
        if (item.snoozedUntil) response.read = false;
      }
      if (body.read !== undefined) {
        item.read = body.read;
        response.read = body.read;
      }
      emit(db, 'notifications', item.ids);
      return ok(response);
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/notifications/read-all',
    handle: (_, db) => {
      const now = Date.now();
      // Snoozed entries keep their unread state for when they come back.
      const unread = db.notifications.filter((entry) => !entry.read && inView(entry, 'inbox', now));
      for (const item of unread) item.read = true;
      emit(
        db,
        'notifications',
        unread.map((entry) => entry.id),
      );
      return ok({ updated: unread.length });
    },
  },
];
