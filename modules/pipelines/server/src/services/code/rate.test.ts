import { RateLimitedError } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import { createTokenBucket } from './rate.ts';

function clock() {
  let now = 0;
  return {
    now: () => now,
    sleep: async (ms: number) => {
      now += ms;
    },
  };
}

describe('the per-installation token bucket', () => {
  it('lets live work spend the whole budget and bulk work stop at the reserve', async () => {
    const time = clock();
    const bucket = createTokenBucket({
      perHour: 10,
      reserve: 0.3,
      ...time,
      maxBulkWaitMs: 0,
      maxLiveWaitMs: 0,
    });
    for (let i = 0; i < 7; i += 1) await bucket.take('install-1', 'bulk');
    await expect(bucket.take('install-1', 'bulk')).rejects.toBeInstanceOf(RateLimitedError);
    for (let i = 0; i < 3; i += 1) await bucket.take('install-1', 'live');
    await expect(bucket.take('install-1', 'live')).rejects.toBeInstanceOf(RateLimitedError);
    expect(bucket.available('install-2')).toBe(10);
  });

  it('waits for the refill when the wait is short enough', async () => {
    const time = clock();
    const bucket = createTokenBucket({ perHour: 3600, ...time });
    for (let i = 0; i < 3600; i += 1) await bucket.take('install-1', 'live');
    await bucket.take('install-1', 'live');
    expect(time.now()).toBe(1000);
  });
});
