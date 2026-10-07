import type { SqlClient } from '../../clients/postgres.ts';
import type { Logger } from '../../config/logger.ts';
import type { JobDefinition } from '../../modules/registries.ts';

export const HOUSEKEEPING_JOB = 'system.housekeeping';

/** A non-transactional changeset "started" longer ago than this is reported as stuck. */
export const STUCK_STARTED_MINUTES = 60;
/** Sent emails are kept this long for the delivery log, then pruned. */
export const SENT_EMAIL_RETENTION_DAYS = 30;

/**
 * Extra cleanup another kernel service owns, e.g. the identity service's
 * `(now) => deleteExpiredSessions(db, now)`. Returns how many rows it removed.
 */
export interface HousekeepingTask {
  name: string;
  run(now: Date): Promise<number | void>;
}

export interface HousekeepingResult {
  expiredIdempotencyKeys: number;
  prunedSentEmails: number;
  stuckChangesets: { module: string; id: string }[];
  tasks: Record<string, number>;
}

async function tableExists(sql: SqlClient, table: string): Promise<boolean> {
  const [row] = await sql<
    { present: boolean }[]
  >`select to_regclass(${table}) is not null as present`;
  return row?.present ?? false;
}

/**
 * Deletes expired idempotency keys and old sent emails, runs the registered
 * tasks, and reports changesets stuck in "started". Changelog rows are never
 * deleted: a stuck one needs a person (`db update --retry-started`).
 */
export async function runHousekeeping(
  sql: SqlClient,
  logger: Logger,
  tasks: readonly HousekeepingTask[] = [],
  now: Date = new Date(),
): Promise<HousekeepingResult> {
  // The pool is Drizzle-wrapped: timestamps are bound as ISO text, not Date.
  const at = now.toISOString();
  const expired = await sql`delete from idempotency_keys where expires_at < ${at}::timestamptz`;
  const prunedSentEmails = (await tableExists(sql, 'email_outbox'))
    ? (
        await sql`
          delete from email_outbox where status = 'sent'
            and sent_at < ${at}::timestamptz - make_interval(days => ${SENT_EMAIL_RETENTION_DAYS})`
      ).count
    : 0;
  const stuck = await sql<{ module: string; id: string }[]>`
    select module, id from schema_changelog
    where state = 'started'
      and updated_at < ${at}::timestamptz - make_interval(mins => ${STUCK_STARTED_MINUTES})`;
  for (const row of stuck) {
    logger.warn(
      row,
      'changeset is stuck in "started"; run db update --retry-started after checking',
    );
  }
  const results: Record<string, number> = {};
  for (const task of tasks) results[task.name] = (await task.run(now)) ?? 0;
  return {
    expiredIdempotencyKeys: expired.count,
    prunedSentEmails,
    stuckChangesets: [...stuck],
    tasks: results,
  };
}

export function housekeepingJob(
  sql: SqlClient,
  logger: Logger,
  tasks: readonly HousekeepingTask[] = [],
): JobDefinition {
  return {
    name: HOUSEKEEPING_JOB,
    scheduleSetting: 'system.jobs.housekeeping.schedule',
    singleton: true,
    retryLimit: 1,
    async handle() {
      const result = await runHousekeeping(sql, logger, tasks);
      logger.info(
        {
          expired: result.expiredIdempotencyKeys,
          sentEmails: result.prunedSentEmails,
          stuck: result.stuckChangesets.length,
          tasks: result.tasks,
        },
        'housekeeping done',
      );
    },
  };
}
