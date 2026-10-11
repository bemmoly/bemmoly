import type { Job, PgBoss } from 'pg-boss';
import { pino } from 'pino';
import { describe, expect, it, vi } from 'vitest';
import type { JobDefinition } from '../../modules/registries.ts';
import { noJobMetrics } from './metrics.ts';
import { createJobSlots } from './slots.ts';
import { loopsFor, workQueue } from './worker.ts';

type Handler = (jobs: Job<unknown>[]) => Promise<void>;

function fakeBoss() {
  const handlers: Handler[] = [];
  const work = vi.fn(async (_name: string, _options: object, handler: Handler) => {
    handlers.push(handler);
    return `worker-${handlers.length}`;
  });
  const notifyWorker = vi.fn();
  return { boss: { work, notifyWorker } as unknown as PgBoss, work, notifyWorker, handlers };
}

const job = (): Job<unknown> => ({
  id: 'job-1',
  name: 'x.y',
  data: { payload: {} },
  expireInSeconds: 60,
  heartbeatSeconds: null,
  retryCount: 0,
  signal: new AbortController().signal,
});

const options = {
  slots: createJobSlots(4),
  logger: pino({ level: 'silent' }),
  metrics: noJobMetrics,
};

describe('workQueue', () => {
  it('starts one single-job loop per unit of concurrency at the polling interval', async () => {
    const { boss, work } = fakeBoss();
    await workQueue(boss, { name: 'x.y', handle: async () => undefined, concurrency: 2 }, options);
    expect(work).toHaveBeenCalledTimes(2);
    expect(work).toHaveBeenCalledWith(
      'x.y',
      { batchSize: 1, localConcurrency: 1, pollingIntervalSeconds: 2 },
      expect.any(Function),
    );
  });

  it('wakes the loop that finished a job so it fetches again at once', async () => {
    const { boss, notifyWorker, handlers } = fakeBoss();
    await workQueue(boss, { name: 'x.y', handle: async () => undefined, concurrency: 2 }, options);
    await handlers[1]!([job()]);
    expect(notifyWorker).toHaveBeenCalledExactlyOnceWith('worker-2');
  });

  it('lets a loop whose job failed wait out the polling interval', async () => {
    const { boss, notifyWorker, handlers } = fakeBoss();
    const handle = async () => {
      throw new Error('boom');
    };
    await workQueue(boss, { name: 'x.y', handle }, { ...options, pollingIntervalSeconds: 5 });
    await expect(handlers[0]!([job()])).rejects.toThrow('boom');
    expect(notifyWorker).not.toHaveBeenCalled();
  });
});

describe('fetch loops per queue', () => {
  const definition = (concurrency?: number): JobDefinition => ({
    name: 'x.y',
    handle: async () => undefined,
    ...(concurrency === undefined ? {} : { concurrency }),
  });

  it('follows the queue’s concurrency, one by default, within the process limit', () => {
    const slots = createJobSlots(4);
    expect(loopsFor(definition(), slots)).toBe(1);
    expect(loopsFor(definition(3), slots)).toBe(3);
    expect(loopsFor(definition(16), slots)).toBe(4);
    expect(loopsFor(definition(0), slots)).toBe(1);
  });
});
