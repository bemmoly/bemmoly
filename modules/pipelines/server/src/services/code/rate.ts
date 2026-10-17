import { RateLimitedError } from '@bemmoly/shared';

/*
 * One token bucket per code host installation (architecture §8). GitHub gives an
 * installation a budget per hour; live work (checks for running jobs, deployments, pushes)
 * may spend all of it, while bulk work (discovery, fleet campaigns) stops at a reserve so it
 * can never starve live runs. Per process: replicas each hold a share, which errs on the
 * side of spending less than the host allows.
 */

export type HostPriority = 'live' | 'bulk';

export interface TokenBucketOptions {
  /** Requests per hour the host allows an installation. */
  perHour?: number;
  /** The share bulk work leaves untouched, 0 to 1. */
  reserve?: number;
  /** The longest a live call waits for a token before it fails. */
  maxLiveWaitMs?: number;
  maxBulkWaitMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export interface TokenBucket {
  take(key: string, priority: HostPriority): Promise<void>;
  /** Tokens left for a key, for tests and the Capacity screen. */
  available(key: string): number;
}

export function createTokenBucket(options: TokenBucketOptions = {}): TokenBucket {
  const capacity = options.perHour ?? 5_000;
  const perMs = capacity / 3_600_000;
  const reserve = capacity * (options.reserve ?? 0.3);
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const state = new Map<string, { tokens: number; at: number }>();

  function refill(key: string) {
    const current = state.get(key) ?? { tokens: capacity, at: now() };
    const tokens = Math.min(capacity, current.tokens + (now() - current.at) * perMs);
    const next = { tokens, at: now() };
    state.set(key, next);
    return next;
  }

  return {
    available: (key) => refill(key).tokens,
    async take(key, priority) {
      const floor = priority === 'bulk' ? reserve : 0;
      const maxWait =
        priority === 'bulk'
          ? (options.maxBulkWaitMs ?? 300_000)
          : (options.maxLiveWaitMs ?? 30_000);
      let waited = 0;
      for (;;) {
        const bucket = refill(key);
        if (bucket.tokens - 1 >= floor) {
          bucket.tokens -= 1;
          return;
        }
        const wait = Math.ceil((floor + 1 - bucket.tokens) / perMs);
        if (waited + wait > maxWait) {
          throw new RateLimitedError(
            'The code host budget for this hour is spent; try again soon',
            {
              retryAfterSeconds: Math.ceil(wait / 1000),
            },
          );
        }
        await sleep(wait);
        waited += wait;
      }
    },
  };
}
