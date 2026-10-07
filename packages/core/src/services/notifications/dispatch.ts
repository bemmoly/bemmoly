import {
  defaultChannelFor,
  notificationRequestedPayloadSchema,
  parseOrThrow,
  type NotificationRequest,
} from '@bemmoly/shared';
import type { SqlExecutor } from '../../contracts/sql.ts';
import type { DirectoryUser } from '../../contracts/users.ts';
import { renderEmail } from '../email/index.ts';
import {
  DIGEST_JOB,
  inTransaction,
  NOTIFICATIONS_REALTIME_KIND,
  nowOf,
  type DigestJobPayload,
  type NotificationsDependencies,
} from './context.ts';
import { reasonFor } from './copy.ts';
import { immediateEmailContent } from './emails.ts';
import type { StoredNotification } from './grouping.ts';
import { channelsForKind, readSchedules } from './preferences-store.ts';
import { insertNotification } from './repository.ts';
import { nextDigestAt } from './schedule.ts';

async function queueImmediateEmail(
  deps: NotificationsDependencies,
  db: SqlExecutor,
  user: DirectoryUser,
  row: StoredNotification,
  request: NotificationRequest,
): Promise<void> {
  const label = row.targetLabel ?? row.targetId;
  const { frame, headers } = await deps.email.frame(reasonFor(row.kind, label, row.reason), {
    userId: user.id,
    scope: row.kind,
  });
  const content = immediateEmailContent(frame, row, request.data ?? {}, deps.email.absoluteUrl);
  const email = await renderEmail(frame, content);
  await deps.email.queue(db, {
    kind: `notification.${row.kind}`,
    toAddress: user.email,
    toName: user.name,
    ...email,
    headers,
    dedupeKey: `notification:${row.id}`,
  });
}

/**
 * Handles `notification.requested`: one inbox row per recipient (never the
 * actor), written in the publisher's transaction when it passed one. Each row
 * then follows the recipient's preference for the kind: an email now, a place
 * in the next digest, or the inbox only. Returns the new row ids.
 */
export async function dispatchNotification(
  deps: NotificationsDependencies,
  input: unknown,
  transaction?: SqlExecutor,
): Promise<string[]> {
  const request = parseOrThrow(notificationRequestedPayloadSchema, input);
  const recipientIds = [...new Set(request.recipientIds)].filter((id) => id !== request.actorId);
  if (recipientIds.length === 0) return [];
  const users = (await deps.users.findByIds(recipientIds)).filter((user) => user.active);
  if (users.length === 0) return [];
  const { digestMinutes } = await deps.email.config();
  const targetUrl = request.target.url ? deps.email.absoluteUrl(request.target.url) : null;

  return inTransaction(deps, transaction, async (db) => {
    const userIds = users.map((user) => user.id);
    const channels = await channelsForKind(db, userIds, request.kind);
    const schedules = await readSchedules(db, userIds);
    const created: string[] = [];
    for (const user of users) {
      const channel = channels.get(user.id) ?? defaultChannelFor(request.kind);
      if (channel === 'off') continue;
      const row = await insertNotification(db, {
        userId: user.id,
        kind: request.kind,
        actorId: request.actorId ?? null,
        actorName: request.actorName ?? null,
        targetKind: request.target.kind,
        targetId: request.target.id,
        targetLabel: request.target.label ?? null,
        targetUrl,
        body: request.body,
        reason: request.reason ?? null,
        data: request.data ?? {},
        delivery: channel,
        dedupeKey: request.dedupeKey ?? null,
      });
      if (!row) continue;
      created.push(row.id);
      if (channel === 'email_immediate') {
        await queueImmediateEmail(deps, db, user, row, request);
      } else if (channel === 'email_digest') {
        const schedule = schedules.get(user.id);
        const payload: DigestJobPayload = { userId: user.id };
        await deps.jobs.enqueue(DIGEST_JOB, payload, {
          key: `digest:${user.id}`,
          singleton: true,
          startAfter: schedule
            ? nextDigestAt(nowOf(deps), schedule, digestMinutes)
            : digestMinutes * 60,
          transaction: db,
        });
      }
      await deps.realtime.publish(
        { kind: NOTIFICATIONS_REALTIME_KIND, ids: [row.id], userId: user.id },
        { transaction: db },
      );
    }
    return created;
  });
}
