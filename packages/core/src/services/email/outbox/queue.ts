import type { JobQueue } from '../../../contracts/jobs.ts';
import type { SqlExecutor } from '../../../contracts/sql.ts';
import { insertOutboxEmail, type NewOutboxEmail } from './repository.ts';

export const EMAIL_SEND_JOB = 'email.send';

export interface EmailSendJobPayload {
  /** One row; absent on the scheduled sweep, which drains every due row. */
  outboxId?: string;
}

/**
 * The only way product code sends email: a row in the caller's transaction and
 * a job enqueued in that same transaction, so the email exists if and only if
 * the change that caused it commits. Returns the outbox row id.
 */
export async function queueEmail(
  jobs: JobQueue,
  db: SqlExecutor,
  email: NewOutboxEmail,
): Promise<string> {
  const { id, created } = await insertOutboxEmail(db, email);
  if (created) {
    const payload: EmailSendJobPayload = { outboxId: id };
    await jobs.enqueue(EMAIL_SEND_JOB, payload, {
      key: `email:${id}`,
      singleton: true,
      transaction: db,
    });
  }
  return id;
}
