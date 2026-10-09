import type { FastifyRateLimitStore, FastifyRateLimitStoreCtor } from '@fastify/rate-limit';
import type { SqlClient } from '../clients/postgres.ts';

export interface BucketState {
  count: number;
  /** Milliseconds until the window resets; 0 when the bucket is empty. */
  ttlMs: number;
}

/** Fixed windows in one UNLOGGED table, so every replica counts against the same budget. */
export class RateLimitBuckets {
  readonly #sql: SqlClient;
  readonly #sweepProbability: number;

  constructor(sql: SqlClient, sweepProbability: number) {
    this.#sql = sql;
    this.#sweepProbability = sweepProbability;
  }

  /** Counts one hit and returns the bucket after it, in one atomic statement. */
  async hit(key: string, windowMs: number): Promise<BucketState> {
    const seconds = windowMs / 1000;
    const [row] = await this.#sql<{ count: number; ttl: number }[]>`
      insert into rate_limit_buckets as b (key, count, expires_at)
      values (${key}, 1, now() + make_interval(secs => ${seconds}))
      on conflict (key) do update set
        count = case when b.expires_at <= now() then 1 else b.count + 1 end,
        expires_at = case when b.expires_at <= now()
          then now() + make_interval(secs => ${seconds}) else b.expires_at end
      returning count, greatest(0, ceil(extract(epoch from (expires_at - now())) * 1000))::int as ttl`;
    if (Math.random() < this.#sweepProbability) {
      await this.#sql`delete from rate_limit_buckets where expires_at < now()`;
    }
    return { count: row?.count ?? 1, ttlMs: row?.ttl ?? windowMs };
  }

  /** Reads a bucket without counting. */
  async peek(key: string): Promise<BucketState> {
    const [row] = await this.#sql<{ count: number; ttl: number }[]>`
      select count, ceil(extract(epoch from (expires_at - now())) * 1000)::int as ttl
      from rate_limit_buckets where key = ${key} and expires_at > now()`;
    return { count: row?.count ?? 0, ttlMs: row?.ttl ?? 0 };
  }
}

type IncrCallback = Parameters<FastifyRateLimitStore['incr']>[1];

/** The same buckets behind @fastify/rate-limit's store interface, one prefix per route. */
class PostgresStore implements FastifyRateLimitStore {
  readonly #buckets: RateLimitBuckets;
  readonly #prefix: string;

  constructor(buckets: RateLimitBuckets, prefix: string) {
    this.#buckets = buckets;
    this.#prefix = prefix;
  }

  incr(key: string, callback: IncrCallback, timeWindow: number): void {
    this.#buckets.hit(`${this.#prefix}|${key}`, timeWindow).then(
      ({ count, ttlMs }) => callback(null, { current: count, ttl: ttlMs }),
      (error: unknown) => callback(error instanceof Error ? error : new Error(String(error))),
    );
  }

  child(routeOptions: { method?: string | string[]; url?: string; routeInfo?: unknown }) {
    const info = (routeOptions.routeInfo ?? routeOptions) as { method?: unknown; url?: unknown };
    return new PostgresStore(this.#buckets, `${String(info.method)} ${String(info.url)}`);
  }
}

export function storeClass(buckets: RateLimitBuckets): FastifyRateLimitStoreCtor {
  return class GlobalPostgresStore extends PostgresStore {
    constructor() {
      super(buckets, 'global');
    }
  } as unknown as FastifyRateLimitStoreCtor;
}
