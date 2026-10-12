import { describe, expect, it } from 'vitest';
import { AuthorizationCache } from './shared-cache.ts';

function clock() {
  let now = 1_000;
  return { now: () => now, advance: (ms: number) => (now += ms) };
}

describe('the process authorization cache', () => {
  it('reuses an answer within the TTL and loads again after it', async () => {
    const time = clock();
    const cache = new AuthorizationCache({ ttlMs: 5_000, now: time.now });
    let loads = 0;
    const load = async () => ++loads;
    expect(await cache.memo('k', load)).toBe(1);
    time.advance(4_999);
    expect(await cache.memo('k', load)).toBe(1);
    time.advance(1);
    expect(await cache.memo('k', load)).toBe(2);
  });

  it('loads again right after a clear', async () => {
    const cache = new AuthorizationCache();
    let loads = 0;
    const load = async () => ++loads;
    await cache.memo('k', load);
    cache.clear();
    expect(await cache.memo('k', load)).toBe(2);
  });

  it('never keeps a failed load', async () => {
    const cache = new AuthorizationCache();
    await expect(cache.memo('k', () => Promise.reject(new Error('down')))).rejects.toThrow('down');
    expect(await cache.memo('k', async () => 'up')).toBe('up');
  });

  it('drops a load that was in flight when the cache was cleared', async () => {
    const cache = new AuthorizationCache();
    let release: (value: string) => void = () => undefined;
    const stale = cache.memo('k', () => new Promise<string>((resolve) => (release = resolve)));
    cache.clear();
    release('before the change');
    expect(await stale).toBe('before the change');
    expect(await cache.memo('k', async () => 'after the change')).toBe('after the change');
  });

  it('forgets one key and leaves the rest', async () => {
    const cache = new AuthorizationCache();
    await cache.memo('a', async () => 1);
    await cache.memo('b', async () => 2);
    cache.forget('a');
    expect(cache.size).toBe(1);
    expect(await cache.memo('a', async () => 3)).toBe(3);
  });
});
