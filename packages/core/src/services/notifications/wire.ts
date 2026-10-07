import type { Logger } from 'pino';
import { createTxtLookup, type TxtLookup } from '../../clients/dns.ts';
import type { SqlClient } from '../../clients/postgres.ts';
import type { Env } from '../../config/env.ts';
import type { AuthenticateRequest } from '../../contracts/authn.ts';
import type { Authorize } from '../../contracts/authz.ts';
import type { EventBus, Unsubscribe } from '../../contracts/event-bus.ts';
import type { JobQueue } from '../../contracts/jobs.ts';
import type { RealtimePublisher } from '../../contracts/realtime.ts';
import type { SettingsService } from '../../contracts/settings.ts';
import type { UserDirectory } from '../../contracts/users.ts';
import {
  createEmailService,
  registerEmailJobs,
  type EmailService,
  type LogoUrlResolver,
  type MailboxStore,
} from '../email/index.ts';
import { createNotificationsService, type NotificationsService } from './service.ts';
import { registerNotificationJobs, subscribeNotificationEvents } from './subscriptions.ts';

export interface EmailNotificationsWiring {
  env: Pick<Env, 'BEMMOLY_PUBLIC_URL' | 'BEMMOLY_SECRET_KEY' | 'BEMMOLY_ALLOW_PRIVATE_URLS'>;
  sql: SqlClient;
  settings: SettingsService;
  jobs: JobQueue;
  realtime: RealtimePublisher;
  events: EventBus;
  users: UserDirectory;
  authorize: Authorize;
  authenticate: AuthenticateRequest;
  logger: Logger;
  mailbox?: MailboxStore;
  resolveLogoUrl?: LogoUrlResolver;
  /** SPF and DMARC lookups for the SMTP test; tests pass a fake resolver. */
  txtLookup?: TxtLookup;
}

export interface EmailNotifications {
  email: EmailService;
  notifications: NotificationsService;
  /** Pass as `emailNotifications` to `kernelRoutes`. */
  routes: {
    authenticate: AuthenticateRequest;
    email: EmailService;
    notifications: NotificationsService;
  };
  /** Removes the event subscriptions; jobs stop with the queue. */
  stop: Unsubscribe;
}

const DNS_TIMEOUT_MS = 5_000;

/**
 * The host's one call: builds both services, registers `email.send` and
 * `notifications.digest` on the job queue and subscribes to the three events.
 */
export function wireEmailNotifications(wiring: EmailNotificationsWiring): EmailNotifications {
  const logger = wiring.logger.child({ service: 'email' });
  const email = createEmailService({
    db: wiring.sql,
    settings: wiring.settings,
    jobs: wiring.jobs,
    authorize: wiring.authorize,
    users: wiring.users,
    logger,
    publicUrl: wiring.env.BEMMOLY_PUBLIC_URL,
    secretKey: wiring.env.BEMMOLY_SECRET_KEY,
    allowPrivateHosts: wiring.env.BEMMOLY_ALLOW_PRIVATE_URLS,
    txtLookup: wiring.txtLookup ?? createTxtLookup(DNS_TIMEOUT_MS),
    ...(wiring.mailbox ? { mailbox: wiring.mailbox } : {}),
    ...(wiring.resolveLogoUrl ? { resolveLogoUrl: wiring.resolveLogoUrl } : {}),
  });
  const notifications = createNotificationsService({
    sql: wiring.sql,
    email,
    users: wiring.users,
    jobs: wiring.jobs,
    realtime: wiring.realtime,
    events: wiring.events,
    logger: wiring.logger.child({ service: 'notifications' }),
  });
  registerEmailJobs(wiring.jobs, email);
  registerNotificationJobs(wiring.jobs, notifications);
  const stop = subscribeNotificationEvents(wiring.events, notifications);
  return {
    email,
    notifications,
    routes: { authenticate: wiring.authenticate, email, notifications },
    stop,
  };
}
