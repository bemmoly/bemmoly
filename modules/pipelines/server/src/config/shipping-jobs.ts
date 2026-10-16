import type { JobDefinition, JobRegistry } from '@bemmoly/core';
import { z } from 'zod';
import type { ShippingEngine } from '../services/shipping/engine.ts';
import type { Waker } from '../services/shipping/index.ts';

/*
 * The shipping engine's jobs: one wake-up per promotion or deployment at the moment it next
 * has something to do, and a minute sweep behind them so a lost wake-up costs at most a
 * minute. Handlers stay thin; the engine claims each row under a lease, so a wake-up that
 * arrives twice does nothing the second time.
 */

export const SHIPPING_ADVANCE_JOB = 'pipelines.shipping-advance';
export const SHIPPING_SWEEP_JOB = 'pipelines.shipping-sweep';
export const HISTORY_SNAPSHOT_JOB = 'pipelines.history-snapshot';

const advancePayloadSchema = z.object({
  kind: z.enum(['deployment', 'promotion']),
  id: z.uuid(),
});

/** Wake-ups as jobs that start no earlier than asked, deduplicated per moment. */
export function jobWaker(jobs: Pick<JobRegistry, 'send'>): Waker {
  return async (kind, id, at) => {
    await jobs.send(
      SHIPPING_ADVANCE_JOB,
      { kind, id },
      { startAfter: at, idempotencyKey: `${kind}:${id}:${at.toISOString()}` },
    );
  };
}

export function shippingJobs(
  engine: () => ShippingEngine | undefined,
  /** Takes the hourly snapshot rewind starts from. */
  snapshot?: () => Promise<unknown>,
): JobDefinition[] {
  return [
    {
      name: SHIPPING_ADVANCE_JOB,
      concurrency: 4,
      retryLimit: 3,
      expireInSeconds: 300,
      handle: async (payload) => {
        const { kind, id } = advancePayloadSchema.parse(payload);
        await engine()?.advance(kind, id);
      },
    },
    {
      name: SHIPPING_SWEEP_JOB,
      schedule: '* * * * *',
      singleton: true,
      retryLimit: 0,
      expireInSeconds: 300,
      handle: async () => {
        await engine()?.sweep();
      },
    },
    {
      name: HISTORY_SNAPSHOT_JOB,
      schedule: '7 * * * *',
      singleton: true,
      retryLimit: 2,
      handle: async () => {
        await snapshot?.();
      },
    },
  ];
}
