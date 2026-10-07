import rateLimit, {
  type FastifyRateLimitStore,
  type FastifyRateLimitStoreCtor,
} from '@fastify/rate-limit';
import { RateLimitedError } from '@bemmoly/shared';
import type { FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { SqlClient } from '../clients/postgres.ts';

export interface RateLimitBudget {
  max: number;
  windowMs: number;
}

export interface RateLimitingOptions {
  sql: SqlClient;
  /** Every API request, keyed by person (or by IP when anonymous). */
  perActor?: RateLimitBudget;
  /** Sign-in, password reset, invitation, setup and unsubscribe routes, keyed by IP, per route. */
  strictPerIp?: RateLimitBudget;
  apiPrefix?: string;
  /** Share of calls that also delete expired buckets. */
  sweepProbability?: number;
}

export const DEFAULT_PER_ACTOR: RateLimitBudget = { max: 600, windowMs: 60_000 };
export const DEFAULT_STRICT_PER_IP: RateLimitBudget = { max: 10, windowMs: 60_000 };

type IncrCallback = Parameters<FastifyRateLimitStore['incr']>[1];

/** Fixed windows in one UNLOGGED table, so every replica counts against the same budget. */
class PostgresStore implements FastifyRateLimitStore {
  readonly #sql: SqlClient;
  readonly #prefix: string;
  readonly #sweepProbability: number;

  constructor(sql: SqlClient, prefix: string, sweepProbability: number) {
    this.#sql = sql;
    this.#prefix = prefix;
    this.#sweepProbability = sweepProbability;
  }

  incr(key: string, callback: IncrCallback, timeWindow: number): void {
    this.#increment(`${this.#prefix}|${key}`, timeWindow).then(
      (result) => callback(null, result),
      (error: unknown) => callback(error instanceof Error ? error : new Error(String(error))),
    );
  }

  child(routeOptions: { method?: string | string[]; url?: string; routeInfo?: unknown }) {
    const info = (routeOptions.routeInfo ?? routeOptions) as { method?: unknown; url?: unknown };
    const route = `${String(info.method)} ${String(info.url)}`;
    return new PostgresStore(this.#sql, route, this.#sweepProbability);
  }

  async #increment(key: string, windowMs: number) {
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
    return { current: row?.count ?? 1, ttl: row?.ttl ?? windowMs };
  }
}

function storeClass(sql: SqlClient, sweepProbability: number): FastifyRateLimitStoreCtor {
  return class GlobalPostgresStore extends PostgresStore {
    constructor() {
      super(sql, 'global', sweepProbability);
    }
  } as unknown as FastifyRateLimitStoreCtor;
}

/** Anonymous by design, so budgeted per IP: sign-in, setup and email unsubscribe links. */
const STRICT_PATHS = ['/auth/', '/setup/', '/email-unsubscriptions'];

function actorKey(request: FastifyRequest): string {
  const actor = request.actor ?? null;
  if (actor) return `user:${actor.kind === 'user' ? actor.id : (actor.userId ?? actor.id)}`;
  return `ip:${request.ip}`;
}

/**
 * Always on. API routes share a per-person budget; the anonymous auth and
 * setup routes get a strict per-IP budget each; non-API routes (health,
 * static files) are not counted.
 */
export const rateLimiting = fp<RateLimitingOptions>(
  async (app, options) => {
    const apiPrefix = options.apiPrefix ?? '/api/v1';
    const perActor = options.perActor ?? DEFAULT_PER_ACTOR;
    const strict = options.strictPerIp ?? DEFAULT_STRICT_PER_IP;
    app.addHook('onRoute', (route) => {
      route.config ??= {};
      if (route.config.rateLimit !== undefined) return;
      if (!route.url.startsWith(`${apiPrefix}/`)) {
        route.config.rateLimit = false;
      } else if (STRICT_PATHS.some((path) => route.url.startsWith(`${apiPrefix}${path}`))) {
        route.config.rateLimit = {
          max: strict.max,
          timeWindow: strict.windowMs,
          keyGenerator: (request: FastifyRequest) => `ip:${request.ip}`,
        };
      }
    });
    await app.register(rateLimit, {
      global: true,
      hook: 'preParsing',
      max: perActor.max,
      timeWindow: perActor.windowMs,
      keyGenerator: actorKey,
      store: storeClass(options.sql, options.sweepProbability ?? 0.01),
      errorResponseBuilder: (_request, context) =>
        new RateLimitedError(`Too many requests; try again in ${context.after}`, {
          retryAfterSeconds: Math.max(1, Math.ceil(context.ttl / 1000)),
        }),
    });
  },
  { name: 'bemmoly-rate-limiting', fastify: '5.x' },
);
