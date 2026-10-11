import {
  NotFoundError,
  type NotificationListQuery,
  type NotificationListResponse,
  type NotificationPatchBody,
  type NotificationPatchResponse,
} from '@bemmoly/shared';
import type { Actor } from '../../contracts/authz.ts';
import {
  inboxOwner,
  inTransaction,
  nowOf,
  NOTIFICATIONS_REALTIME_KIND,
  type NotificationsDependencies,
} from './context.ts';
import { groupNotifications } from './grouping.ts';
import { countUnread, listNotifications, markAllRead } from './repository.ts';
import { updateEntry } from './triage.ts';

export async function listInbox(
  deps: NotificationsDependencies,
  actor: Actor,
  query: NotificationListQuery,
): Promise<NotificationListResponse> {
  const userId = inboxOwner(actor);
  const now = nowOf(deps);
  const [page, unreadCount] = await Promise.all([
    listNotifications(deps.sql, {
      userId,
      cursor: query.cursor,
      limit: query.limit,
      unreadOnly: query.unread === true,
      view: query.view,
      now,
    }),
    countUnread(deps.sql, userId, now),
  ]);
  const last = page.rows.at(-1);
  return {
    items: groupNotifications(page.rows),
    nextCursor: page.hasMore && last ? last.id : null,
    unreadCount,
  };
}

/** The read state the entry ends with, when the change decided it. */
function readAfter(body: NotificationPatchBody): boolean | undefined {
  if (body.read !== undefined) return body.read;
  if (body.snoozedUntil) return false;
  return body.done === true ? true : undefined;
}

/**
 * Marks one entry done, snoozed or read. Done and snooze cover the entry's
 * group (the older rows of its kind and target); so does `read: true`.
 */
export async function markInboxEntry(
  deps: NotificationsDependencies,
  actor: Actor,
  id: string,
  body: NotificationPatchBody,
): Promise<NotificationPatchResponse> {
  const userId = inboxOwner(actor);
  const snoozedUntil =
    body.snoozedUntil === undefined || body.snoozedUntil === null
      ? body.snoozedUntil
      : new Date(body.snoozedUntil);
  const ids = await inTransaction(deps, undefined, async (db) => {
    const changed = await updateEntry(db, {
      userId,
      id,
      read: body.read,
      done: body.done,
      snoozedUntil,
    });
    if (!changed) throw new NotFoundError('No such notification in your inbox');
    await deps.realtime.publish(
      { kind: NOTIFICATIONS_REALTIME_KIND, ids: changed, userId },
      { transaction: db },
    );
    return changed;
  });
  const read = readAfter(body);
  return {
    ids,
    ...(read === undefined ? {} : { read }),
    ...(body.done === undefined ? {} : { done: body.done }),
    ...(snoozedUntil === undefined ? {} : { snoozedUntil: snoozedUntil?.toISOString() ?? null }),
  };
}

export async function markInboxRead(
  deps: NotificationsDependencies,
  actor: Actor,
): Promise<{ updated: number }> {
  const userId = inboxOwner(actor);
  const ids = await inTransaction(deps, undefined, async (db) => {
    const changed = await markAllRead(db, userId, nowOf(deps));
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
