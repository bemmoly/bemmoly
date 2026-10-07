import { NOTIFICATION_EVENT_KINDS } from '@bemmoly/shared';
import { z } from 'zod';
import type { EventBus, Unsubscribe } from '../../contracts/event-bus.ts';
import type { JobQueue } from '../../contracts/jobs.ts';
import { DIGEST_JOB } from './context.ts';
import type { NotificationsService } from './service.ts';

/** The three events this service turns into inbox rows and email. */
export function subscribeNotificationEvents(
  bus: EventBus,
  notifications: NotificationsService,
): Unsubscribe {
  const subscriptions = [
    bus.subscribe(NOTIFICATION_EVENT_KINDS.notificationRequested, async (event) => {
      await notifications.onNotificationRequested(event);
    }),
    bus.subscribe(NOTIFICATION_EVENT_KINDS.invitationCreated, (event) =>
      notifications.onInvitationCreated(event),
    ),
    bus.subscribe(NOTIFICATION_EVENT_KINDS.passwordResetRequested, (event) =>
      notifications.onPasswordResetRequested(event),
    ),
  ];
  return () => {
    for (const unsubscribe of subscriptions) unsubscribe();
  };
}

const digestPayloadSchema = z.object({ userId: z.uuid() });

/** `notifications.digest`: enqueued per user with a singleton key, so one waits at a time. */
export function registerNotificationJobs(
  jobs: JobQueue,
  notifications: NotificationsService,
): void {
  jobs.register(
    DIGEST_JOB,
    async (payload) => {
      const { userId } = digestPayloadSchema.parse(payload);
      await notifications.sendDigest(userId);
    },
    { retryLimit: 3, retryDelaySeconds: 60, retryBackoff: true },
  );
}
