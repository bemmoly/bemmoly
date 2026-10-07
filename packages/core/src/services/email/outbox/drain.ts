import type { Logger } from 'pino';
import type { EmailSender } from '../../../contracts/email-sender.ts';
import type { JobQueue } from '../../../contracts/jobs.ts';
import type { SqlExecutor } from '../../../contracts/sql.ts';
import { failureOf, type EmailFailure } from '../senders/failure.ts';
import { EMAIL_SEND_JOB, type EmailSendJobPayload } from './queue.ts';
import {
  claimDueEmails,
  markEmailFailed,
  markEmailSent,
  scheduleEmailRetry,
  type OutboxRow,
} from './repository.ts';

/** Seconds before retry n (1-based): 30 s, 2 min, 10 min, 30 min, 2 h. */
export const RETRY_DELAYS_SECONDS: readonly number[] = [30, 120, 600, 1800, 7200];

export interface DrainPolicy {
  maxAttempts: number;
  /** How long a claimed row stays `sending` before another worker may retry it. */
  leaseSeconds: number;
  batchSize: number;
  /** Rows one sweep handles before yielding to the next scheduled run. */
  sweepLimit: number;
}

export const DEFAULT_DRAIN_POLICY: DrainPolicy = {
  maxAttempts: RETRY_DELAYS_SECONDS.length + 1,
  leaseSeconds: 120,
  batchSize: 20,
  sweepLimit: 200,
};

export interface DrainDependencies {
  db: SqlExecutor;
  jobs: JobQueue;
  /** Built from the current settings for each drain, so a settings change applies at once. */
  sender: () => Promise<EmailSender>;
  logger: Logger;
  policy?: DrainPolicy;
}

export type DeliveryOutcome =
  | { status: 'sent'; messageId: string }
  | { status: 'retrying'; failure: EmailFailure; delaySeconds: number }
  | { status: 'failed'; failure: EmailFailure };

export function retryDelay(attempts: number): number {
  const index = Math.min(attempts, RETRY_DELAYS_SECONDS.length) - 1;
  return RETRY_DELAYS_SECONDS[Math.max(index, 0)] ?? 30;
}

/** A failure in the send stage with a permanent reply (bad address) will not improve with time. */
function worthRetrying(failure: EmailFailure): boolean {
  return failure.transient || failure.stage !== 'send';
}

export async function deliverClaimed(
  deps: DrainDependencies,
  sender: EmailSender,
  row: OutboxRow,
  options: { retry: boolean } = { retry: true },
): Promise<DeliveryOutcome> {
  const policy = deps.policy ?? DEFAULT_DRAIN_POLICY;
  try {
    const result = await sender.send({
      to: [{ address: row.toAddress, ...(row.toName ? { name: row.toName } : {}) }],
      subject: row.subject,
      html: row.html,
      text: row.text,
      headers: row.headers,
      idempotencyKey: row.id,
    });
    await markEmailSent(deps.db, row.id, { provider: sender.id, messageId: result.messageId });
    return { status: 'sent', messageId: result.messageId };
  } catch (error) {
    const failure = failureOf(error);
    const reason = failure.serverResponse
      ? `${failure.message} (server said: ${failure.serverResponse})`
      : failure.message;
    if (options.retry && worthRetrying(failure) && row.attempts < policy.maxAttempts) {
      const delaySeconds = retryDelay(row.attempts);
      await scheduleEmailRetry(deps.db, row.id, {
        provider: sender.id,
        error: reason,
        delaySeconds,
      });
      const payload: EmailSendJobPayload = { outboxId: row.id };
      await deps.jobs.enqueue(EMAIL_SEND_JOB, payload, {
        key: `email:${row.id}:${row.attempts}`,
        singleton: true,
        startAfter: delaySeconds,
      });
      deps.logger.warn(
        { outboxId: row.id, attempts: row.attempts, reason },
        'email send failed; retrying',
      );
      return { status: 'retrying', failure, delaySeconds };
    }
    await markEmailFailed(deps.db, row.id, { provider: sender.id, error: reason });
    deps.logger.error({ outboxId: row.id, attempts: row.attempts, reason }, 'email send failed');
    return { status: 'failed', failure };
  }
}

export interface DrainResult {
  sent: number;
  retrying: number;
  failed: number;
}

/** The `email.send` job: one row when given an id, otherwise every due row up to the sweep limit. */
export async function drainOutbox(
  deps: DrainDependencies,
  payload: EmailSendJobPayload,
): Promise<DrainResult> {
  const policy = deps.policy ?? DEFAULT_DRAIN_POLICY;
  const result: DrainResult = { sent: 0, retrying: 0, failed: 0 };
  let sender: EmailSender | undefined;
  let handled = 0;
  while (handled < policy.sweepLimit) {
    const rows = await claimDueEmails(deps.db, {
      limit: payload.outboxId ? 1 : policy.batchSize,
      leaseSeconds: policy.leaseSeconds,
      ...(payload.outboxId ? { id: payload.outboxId } : {}),
    });
    if (rows.length === 0) break;
    sender ??= await deps.sender();
    for (const row of rows) {
      const outcome = await deliverClaimed(deps, sender, row);
      result[outcome.status] += 1;
    }
    handled += rows.length;
    if (payload.outboxId) break;
  }
  return result;
}
