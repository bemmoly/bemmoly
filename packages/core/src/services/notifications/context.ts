import { ForbiddenError } from '@bemmoly/shared';
import type { Logger } from 'pino';
import type { SqlClient } from '../../clients/postgres.ts';
import type { Actor } from '../../contracts/authz.ts';
import type { EventBus } from '../../contracts/event-bus.ts';
import type { JobQueue } from '../../contracts/jobs.ts';
import type { RealtimePublisher } from '../../contracts/realtime.ts';
import type { SqlExecutor } from '../../contracts/sql.ts';
import type { UserDirectory } from '../../contracts/users.ts';
import type { EmailService } from '../email/index.ts';

export interface NotificationsDependencies {
  sql: SqlClient;
  email: EmailService;
  users: UserDirectory;
  jobs: JobQueue;
  realtime: RealtimePublisher;
  events: EventBus;
  logger: Logger;
  now?: () => Date;
}

export const NOTIFICATIONS_REALTIME_KIND = 'notifications';
export const DIGEST_JOB = 'notifications.digest';

export interface DigestJobPayload {
  userId: string;
}

/** Joins the publisher's transaction when there is one, otherwise opens its own. */
export async function inTransaction<T>(
  deps: NotificationsDependencies,
  existing: SqlExecutor | undefined,
  work: (db: SqlExecutor) => Promise<T>,
): Promise<T> {
  if (existing) return work(existing);
  return (await deps.sql.begin((tx) => work(tx))) as T;
}

/** The person whose inbox and preferences a request touches. */
export function inboxOwner(actor: Actor): string {
  const userId = actor.userId ?? (actor.kind === 'user' ? actor.id : undefined);
  if (!userId) throw new ForbiddenError('Only a person has an inbox');
  return userId;
}

export function nowOf(deps: NotificationsDependencies): Date {
  return deps.now?.() ?? new Date();
}
