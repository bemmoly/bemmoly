import {
  defaultChannelFor,
  KERNEL_NOTIFICATION_KINDS,
  type NotificationChannel,
  type NotificationPreferencesPutBody,
  type NotificationPreferencesResponse,
  type UnsubscribeResponse,
} from '@bemmoly/shared';
import type { Actor } from '../../contracts/authz.ts';
import type { SqlExecutor } from '../../contracts/sql.ts';
import { DIGEST_SCOPE } from '../email/index.ts';
import { inboxOwner, inTransaction, type NotificationsDependencies } from './context.ts';
import { labelFor } from './copy.ts';
import {
  readChannels,
  readSchedules,
  upsertChannels,
  upsertSchedule,
} from './preferences-store.ts';

async function preferencesOf(
  db: SqlExecutor,
  userId: string,
): Promise<NotificationPreferencesResponse> {
  const stored = await readChannels(db, userId);
  const kinds = [...new Set([...KERNEL_NOTIFICATION_KINDS, ...stored.keys()])];
  const schedule = (await readSchedules(db, [userId])).get(userId);
  return {
    kinds: kinds.map((kind) => ({
      kind,
      channel: stored.get(kind) ?? defaultChannelFor(kind),
      defaultChannel: defaultChannelFor(kind),
    })),
    digest: schedule ?? { cadence: 'interval', dailyHour: 8, timeZone: 'UTC' },
  };
}

export async function getPreferences(
  deps: NotificationsDependencies,
  actor: Actor,
): Promise<NotificationPreferencesResponse> {
  return preferencesOf(deps.sql, inboxOwner(actor));
}

export async function putPreferences(
  deps: NotificationsDependencies,
  actor: Actor,
  body: NotificationPreferencesPutBody,
): Promise<NotificationPreferencesResponse> {
  const userId = inboxOwner(actor);
  return inTransaction(deps, undefined, async (db) => {
    if (body.kinds) await upsertChannels(db, userId, Object.entries(body.kinds));
    if (body.digest) await upsertSchedule(db, userId, body.digest);
    return preferencesOf(db, userId);
  });
}

const emailOn = (channel: NotificationChannel) =>
  channel === 'email_immediate' || channel === 'email_digest';

/** What an unsubscribe link would change, for the confirmation page. Anonymous by design. */
export async function previewUnsubscribe(
  deps: NotificationsDependencies,
  token: string,
): Promise<UnsubscribeResponse> {
  const claim = deps.email.unsubscribeSigner.verify(token);
  const stored = await readChannels(deps.sql, claim.userId);
  const channels =
    claim.scope === DIGEST_SCOPE
      ? [...new Set([...KERNEL_NOTIFICATION_KINDS, ...stored.keys()])].map(
          (kind) => stored.get(kind) ?? defaultChannelFor(kind),
        )
      : [stored.get(claim.scope) ?? defaultChannelFor(claim.scope)];
  const enabled =
    claim.scope === DIGEST_SCOPE ? channels.includes('email_digest') : channels.some(emailOn);
  return { scope: claim.scope, label: labelFor(claim.scope), emailEnabled: enabled };
}

/**
 * Turns email off for the token's kind, keeping it in the in-app inbox. The
 * digest token moves every digest kind to in-app only. Anonymous by design:
 * the signed token is the authority, and it can only ever reduce email.
 */
export async function unsubscribe(
  deps: NotificationsDependencies,
  token: string,
): Promise<UnsubscribeResponse> {
  const claim = deps.email.unsubscribeSigner.verify(token);
  const [user] = await deps.users.findByIds([claim.userId]);
  // A deleted account receives nothing already; there is no preference row to write.
  if (!user) return { scope: claim.scope, label: labelFor(claim.scope), emailEnabled: false };
  await inTransaction(deps, undefined, async (db) => {
    const stored = await readChannels(db, claim.userId);
    const scopeKinds =
      claim.scope === DIGEST_SCOPE
        ? [...new Set([...KERNEL_NOTIFICATION_KINDS, ...stored.keys()])]
        : [claim.scope];
    const changes = scopeKinds
      .map((kind) => [kind, stored.get(kind) ?? defaultChannelFor(kind)] as const)
      .filter(([, channel]) =>
        claim.scope === DIGEST_SCOPE ? channel === 'email_digest' : emailOn(channel),
      )
      .map(([kind]) => [kind, 'inapp'] as [string, NotificationChannel]);
    await upsertChannels(db, claim.userId, changes);
  });
  deps.logger.info({ userId: claim.userId, scope: claim.scope }, 'email unsubscribed by link');
  return { scope: claim.scope, label: labelFor(claim.scope), emailEnabled: false };
}
