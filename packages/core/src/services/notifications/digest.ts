import {
  DIGEST_LINE_LIMIT,
  DIGEST_SCOPE,
  digestEmail,
  renderEmail,
  type ActivityLine,
} from '../email/index.ts';
import { inTransaction, type NotificationsDependencies } from './context.ts';
import { actorPhrase } from './copy.ts';
import { groupNotifications } from './grouping.ts';
import { readSchedules } from './preferences-store.ts';
import { claimDigestRows, markEmailed } from './repository.ts';

/** Rows one digest covers; anything beyond waits for the next one. */
const DIGEST_ROW_LIMIT = 200;

/**
 * The `notifications.digest` job for one user: every unread row routed to the
 * digest and not yet emailed becomes one email. Rows read in the app meanwhile
 * are left out, since the person has already seen them.
 */
export async function sendDigest(
  deps: NotificationsDependencies,
  userId: string,
): Promise<{ emailed: number }> {
  const [user] = await deps.users.findByIds([userId]);
  if (!user || !user.active) return { emailed: 0 };
  const { digestMinutes } = await deps.email.config();

  return inTransaction(deps, undefined, async (db) => {
    const rows = await claimDigestRows(db, userId, DIGEST_ROW_LIMIT);
    if (rows.length === 0) return { emailed: 0 };
    const schedule = (await readSchedules(db, [userId])).get(userId);
    const groups = groupNotifications(rows);
    const lines: ActivityLine[] = groups.slice(0, DIGEST_LINE_LIMIT).map((group) => ({
      lead: `${actorPhrase(group.actors.map((actor) => actor.name))} ${group.verb}`,
      targetLabel: group.target.label ?? group.target.id,
      targetUrl: group.target.url,
      body: group.body,
      createdAt: new Date(group.createdAt),
    }));
    const moreCount = Math.max(groups.length - lines.length, 0);
    const period =
      schedule?.cadence === 'daily' ? 'since your last daily summary' : 'since the last email';
    const { frame, headers } = await deps.email.frame(
      schedule?.cadence === 'daily'
        ? "You're receiving this because you chose a daily summary of your notifications."
        : `You're receiving this because your notification settings batch updates every ${digestMinutes} minutes.`,
      { userId, scope: DIGEST_SCOPE },
    );
    const email = await renderEmail(
      frame,
      digestEmail(frame, {
        lines,
        moreCount,
        inboxUrl: deps.email.absoluteUrl('/inbox'),
        period,
      }),
    );
    const [newest] = rows;
    await deps.email.queue(db, {
      kind: 'notification.digest',
      toAddress: user.email,
      toName: user.name,
      ...email,
      headers,
      dedupeKey: `digest:${userId}:${newest?.id ?? ''}`,
    });
    await markEmailed(
      db,
      rows.map((row) => row.id),
    );
    return { emailed: rows.length };
  });
}
