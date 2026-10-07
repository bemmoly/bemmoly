import {
  NotFoundError,
  type NotificationListQuery,
  type NotificationListResponse,
  type NotificationPatchBody,
} from '@bemmoly/shared';
import type { Actor } from '../../contracts/authz.ts';
import {
  inboxOwner,
  inTransaction,
  NOTIFICATIONS_REALTIME_KIND,
  type NotificationsDependencies,
} from './context.ts';
import { groupNotifications } from './grouping.ts';
import { countUnread, listNotifications, markAllRead, setRead } from './repository.ts';

export async function listInbox(
  deps: NotificationsDependencies,
  actor: Actor,
  query: NotificationListQuery,
): Promise<NotificationListResponse> {
  const userId = inboxOwner(actor);
  const [page, unreadCount] = await Promise.all([
    listNotifications(deps.sql, {
      userId,
      cursor: query.cursor,
      limit: query.limit,
      unreadOnly: query.unread === true,
    }),
    countUnread(deps.sql, userId),
  ]);
  const last = page.rows.at(-1);
  return {
    items: groupNotifications(page.rows),
    nextCursor: page.hasMore && last ? last.id : null,
    unreadCount,
  };
}

/** Marks one entry, and with `read: true` the older unread rows of its group. */
export async function markInboxEntry(
  deps: NotificationsDependencies,
  actor: Actor,
  id: string,
  body: NotificationPatchBody,
): Promise<{ ids: string[]; read: boolean }> {
  const userId = inboxOwner(actor);
  const ids = await inTransaction(deps, undefined, async (db) => {
    const changed = await setRead(db, { userId, id, read: body.read });
    if (!changed) throw new NotFoundError('No such notification in your inbox');
    await deps.realtime.publish(
      { kind: NOTIFICATIONS_REALTIME_KIND, ids: changed, userId },
      { transaction: db },
    );
    return changed;
  });
  return { ids, read: body.read };
}

export async function markInboxRead(
  deps: NotificationsDependencies,
  actor: Actor,
): Promise<{ updated: number }> {
  const userId = inboxOwner(actor);
  const ids = await inTransaction(deps, undefined, async (db) => {
    const changed = await markAllRead(db, userId);
    if (changed.length > 0) {
      await deps.realtime.publish(
        { kind: NOTIFICATIONS_REALTIME_KIND, ids: changed, userId },
        { transaction: db },
      );
    }
    return changed;
  });
  return { updated: ids.length };
}
