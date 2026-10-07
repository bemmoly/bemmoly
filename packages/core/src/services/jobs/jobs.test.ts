import type { Job } from 'pg-boss';
import { pino } from 'pino';
import { describe, expect, it, vi } from 'vitest';
import type { JobQueue } from '../../contracts/jobs.ts';
import { createJobQueueHandle } from './handle.ts';
import { wrapHandler } from './handler.ts';

function job(data: unknown): Job<unknown> {
  return {
    id: 'job-1',
    name: 'sample.ping',
    data,
    expireInSeconds: 60,
    heartbeatSeconds: null,
    retryCount: 0,
    signal: new AbortController().signal,
  };
}

describe('wrapHandler', () => {
  it('unwraps the envelope and passes the request id', async () => {
    const handle = vi.fn(async () => undefined);
    await wrapHandler(
      { name: 'sample.ping', handle },
      pino({ level: 'silent' }),
    )([job({ payload: { a: 1 }, requestId: 'req-1' })]);
    expect(handle).toHaveBeenCalledWith(
      { a: 1 },
      expect.objectContaining({ jobId: 'job-1', requestId: 'req-1' }),
    );
  });

  it('takes bare payloads from schedules and rethrows failures for pg-boss to retry', async () => {
    const handle = vi.fn(async () => {
      throw new Error('boom');
    });
    const run = wrapHandler({ name: 'x.y', handle }, pino({ level: 'silent' }));
    await expect(run([job(null)])).rejects.toThrow('boom');
    expect(handle).toHaveBeenCalledWith({}, expect.objectContaining({ requestId: 'job-1' }));
  });
});

describe('job queue handle', () => {
  it('replays registrations on bind and refuses enqueues before it', async () => {
    const handle = createJobQueueHandle();
    const handler = async () => undefined;
    handle.register('email.send', handler, { retryLimit: 0 });
    expect(() => handle.enqueue('email.send', {})).toThrow(/has not started/);
    const queue: JobQueue = { register: vi.fn(), enqueue: vi.fn(async () => 'id-1') };
    handle.bind(queue);
    expect(queue.register).toHaveBeenCalledWith('email.send', handler, { retryLimit: 0 });
    expect(await handle.enqueue('email.send', { outboxId: 'o1' })).toBe('id-1');
  });
});
