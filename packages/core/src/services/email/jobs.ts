import { z } from 'zod';
import type { JobQueue } from '../../contracts/jobs.ts';
import { EMAIL_SEND_JOB } from './outbox/queue.ts';
import type { EmailService } from './service.ts';

const payloadSchema = z.object({ outboxId: z.uuid().optional() });

/**
 * `email.send`: one row per job, singleton per row, plus a sweep every minute
 * that picks up rows whose job was lost and leases that ran out. The handler
 * keeps its own backoff on the row, so the queue does not retry it.
 */
export function registerEmailJobs(jobs: JobQueue, email: EmailService): void {
  jobs.register(
    EMAIL_SEND_JOB,
    async (payload) => {
      const parsed = payloadSchema.parse(payload ?? {});
      await email.drain(parsed.outboxId ? { outboxId: parsed.outboxId } : {});
    },
    { schedule: '* * * * *', retryLimit: 0, concurrency: 2 },
  );
}
