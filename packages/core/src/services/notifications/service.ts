import {
  NOTIFICATION_EVENT_KINDS,
  type DevNotificationBody,
  type NotificationListQuery,
  type NotificationListResponse,
  type NotificationPatchBody,
  type NotificationPatchResponse,
  type NotificationPreferencesPutBody,
  type NotificationPreferencesResponse,
  type NotificationReadAllResponse,
  type UnsubscribeResponse,
} from '@bemmoly/shared';
import type { Actor } from '../../contracts/authz.ts';
import type { DomainEvent } from '../../contracts/event-bus.ts';
import { inboxOwner, nowOf, type NotificationsDependencies } from './context.ts';
import { sendDigest } from './digest.ts';
import { dispatchNotification } from './dispatch.ts';
import { listInbox, markInboxEntry, markInboxRead } from './inbox.ts';
import { getPreferences, previewUnsubscribe, putPreferences, unsubscribe } from './preferences.ts';

export interface NotificationsService {
  onNotificationRequested(event: DomainEvent): Promise<string[]>;
  onInvitationCreated(event: DomainEvent): Promise<void>;
  onPasswordResetRequested(event: DomainEvent): Promise<void>;
  sendDigest(userId: string): Promise<{ emailed: number }>;
  list(actor: Actor, query: NotificationListQuery): Promise<NotificationListResponse>;
  mark(actor: Actor, id: string, body: NotificationPatchBody): Promise<NotificationPatchResponse>;
  readAll(actor: Actor): Promise<NotificationReadAllResponse>;
  preferences(actor: Actor): Promise<NotificationPreferencesResponse>;
  updatePreferences(
    actor: Actor,
    body: NotificationPreferencesPutBody,
  ): Promise<NotificationPreferencesResponse>;
  previewUnsubscribe(token: string): Promise<UnsubscribeResponse>;
  unsubscribe(token: string): Promise<UnsubscribeResponse>;
  /** Publishes `notification.requested` for the signed-in user; only while the provider is `log`. */
  devNotify(actor: Actor, body: DevNotificationBody): Promise<{ accepted: boolean }>;
}

export function createNotificationsService(deps: NotificationsDependencies): NotificationsService {
  return {
    onNotificationRequested: (event) =>
      dispatchNotification(deps, event.payload, event.transaction),
    async onInvitationCreated(event) {
      await deps.email.queueInvitation(event.transaction ?? deps.sql, event.payload);
    },
    async onPasswordResetRequested(event) {
      await deps.email.queuePasswordReset(event.transaction ?? deps.sql, event.payload);
    },
    sendDigest: (userId) => sendDigest(deps, userId),
    list: (actor, query) => listInbox(deps, actor, query),
    mark: (actor, id, body) => markInboxEntry(deps, actor, id, body),
    readAll: (actor) => markInboxRead(deps, actor),
    preferences: (actor) => getPreferences(deps, actor),
    updatePreferences: (actor, body) => putPreferences(deps, actor, body),
    previewUnsubscribe: (token) => previewUnsubscribe(deps, token),
    unsubscribe: (token) => unsubscribe(deps, token),
    async devNotify(actor, body) {
      await deps.email.requireDevTools();
      const recipientIds = body.recipientIds ?? [inboxOwner(actor)];
      await deps.events.publish({
        kind: NOTIFICATION_EVENT_KINDS.notificationRequested,
        occurredAt: nowOf(deps),
        actor,
        payload: {
          kind: body.kind,
          recipientIds,
          actorName: body.actorName,
          target: body.target,
          body: body.body,
        },
      });
      return { accepted: true };
    },
  };
}
