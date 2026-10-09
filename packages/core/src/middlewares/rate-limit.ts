import rateLimit from '@fastify/rate-limit';
import { RateLimitedError } from '@bemmoly/shared';
import type { FastifyRequest, RouteOptions } from 'fastify';
import fp from 'fastify-plugin';
import type { SqlClient } from '../clients/postgres.ts';
import type { Env } from '../config/env.ts';
import { readCookie, SESSION_COOKIE } from '../utils/session-cookie.ts';
import { accountBucketKey, accountOfRoute } from './rate-limit-accounts.ts';
import { RateLimitBuckets, storeClass } from './rate-limit-store.ts';

export interface RateLimitBudget {
  max: number;
  windowMs: number;
}

export interface RateLimitBudgets {
  /** Every API request, keyed by person (or by IP when anonymous). */
  perActor: RateLimitBudget;
  /** Sign-in, password reset, invitation, setup and unsubscribe routes, keyed by IP, per route. */
  strictPerIp: RateLimitBudget;
  /** Sign-in, password reset and invitation accept, keyed by the account named, per route. */
  perAccount: RateLimitBudget;
  /** Session cookies and API tokens looked up and refused, keyed by IP. */
  failedCredentialsPerIp: RateLimitBudget;
}

export interface RateLimitingOptions extends Partial<RateLimitBudgets> {
  sql: SqlClient;
  apiPrefix?: string;
  /** Share of calls that also delete expired buckets. */
  sweepProbability?: number;
}

const MINUTE = 60_000;

export const DEFAULT_PER_ACTOR: RateLimitBudget = { max: 600, windowMs: MINUTE };
export const DEFAULT_STRICT_PER_IP: RateLimitBudget = { max: 10, windowMs: MINUTE };
export const DEFAULT_PER_ACCOUNT: RateLimitBudget = { max: 10, windowMs: 15 * MINUTE };
export const DEFAULT_FAILED_CREDENTIALS_PER_IP: RateLimitBudget = { max: 60, windowMs: MINUTE };

export type RateLimitEnv = Partial<
  Pick<
    Env,
    | 'BEMMOLY_RATE_LIMIT_PER_USER'
    | 'BEMMOLY_RATE_LIMIT_AUTH_PER_IP'
    | 'BEMMOLY_RATE_LIMIT_AUTH_PER_ACCOUNT'
    | 'BEMMOLY_RATE_LIMIT_FAILED_CREDENTIALS_PER_IP'
  >
>;

const withMax = (budget: RateLimitBudget, max: number | undefined) =>
  max === undefined ? budget : { ...budget, max };

/** The budgets an install runs with: the defaults, with any maximum the env overrides. */
export function rateLimitBudgets(env: RateLimitEnv): RateLimitBudgets {
  return {
    perActor: withMax(DEFAULT_PER_ACTOR, env.BEMMOLY_RATE_LIMIT_PER_USER),
    strictPerIp: withMax(DEFAULT_STRICT_PER_IP, env.BEMMOLY_RATE_LIMIT_AUTH_PER_IP),
    perAccount: withMax(DEFAULT_PER_ACCOUNT, env.BEMMOLY_RATE_LIMIT_AUTH_PER_ACCOUNT),
    failedCredentialsPerIp: withMax(
      DEFAULT_FAILED_CREDENTIALS_PER_IP,
      env.BEMMOLY_RATE_LIMIT_FAILED_CREDENTIALS_PER_IP,
    ),
  };
}

function rateLimited(ttlMs: number): RateLimitedError {
  const retryAfterSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
  return new RateLimitedError(`Too many requests; try again in ${retryAfterSeconds} seconds`, {
    retryAfterSeconds,
  });
}

/** Anonymous by design, so budgeted per IP: sign-in, setup and email unsubscribe links. */
const STRICT_PATHS = ['/auth/', '/setup/', '/email-unsubscriptions'];

function actorKey(request: FastifyRequest): string {
  const actor = request.actor ?? null;
  if (actor) return `user:${actor.kind === 'user' ? actor.id : (actor.userId ?? actor.id)}`;
  return `ip:${request.ip}`;
}

const presentsCredential = (request: FastifyRequest) =>
  request.headers.authorization !== undefined ||
  readCookie(request.headers.cookie, SESSION_COOKIE) !== undefined;

function appendPreHandler(route: RouteOptions, hook: (request: FastifyRequest) => Promise<void>) {
  const existing = route.preHandler;
  route.preHandler = [...(Array.isArray(existing) ? existing : existing ? [existing] : []), hook];
}

/**
 * Always on. API routes share a per-person budget; the anonymous auth and
 * setup routes get a strict per-IP budget each, and those that name an account
 * a per-account budget as well; non-API routes (health, static files) are not counted.
 * Register before authentication: an address that keeps presenting refused
 * cookies or tokens is turned away before the next one is looked up.
 */
export const rateLimiting = fp<RateLimitingOptions>(
  async (app, options) => {
    const apiPrefix = options.apiPrefix ?? '/api/v1';
    const perActor = options.perActor ?? DEFAULT_PER_ACTOR;
    const strict = options.strictPerIp ?? DEFAULT_STRICT_PER_IP;
    const perAccount = options.perAccount ?? DEFAULT_PER_ACCOUNT;
    const failed = options.failedCredentialsPerIp ?? DEFAULT_FAILED_CREDENTIALS_PER_IP;
    const buckets = new RateLimitBuckets(options.sql, options.sweepProbability ?? 0.01);
    const failedKey = (request: FastifyRequest) => `credentials|ip:${request.ip}`;

    // Only refusals count, so requests with valid credentials never use up this budget.
    app.addHook('onRequest', async (request) => {
      if (!presentsCredential(request)) return;
      const { count, ttlMs } = await buckets.peek(failedKey(request));
      if (count >= failed.max) throw rateLimited(ttlMs);
    });
    // Counted before the reply leaves, so the next request from that address sees it.
    app.addHook('onSend', async (request, _reply, payload) => {
      if (request.credentialRejected) await buckets.hit(failedKey(request), failed.windowMs);
      return payload;
    });

    app.addHook('onRoute', (route) => {
      route.config ??= {};
      const path = route.url.startsWith(`${apiPrefix}/`) ? route.url.slice(apiPrefix.length) : '';
      const method = String(route.method);
      const accountOf = path ? accountOfRoute(method, path) : undefined;
      if (accountOf) {
        // After parsing, because the account is named in the body or the path.
        appendPreHandler(route, async (request) => {
          const account = accountOf(request);
          if (account === undefined) return;
          const key = accountBucketKey(`${method} ${route.url}`, account);
          const { count, ttlMs } = await buckets.hit(key, perAccount.windowMs);
          if (count > perAccount.max) throw rateLimited(ttlMs);
        });
      }
      if (route.config.rateLimit !== undefined) return;
      if (!path) {
        route.config.rateLimit = false;
      } else if (STRICT_PATHS.some((prefix) => path.startsWith(prefix))) {
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
      store: storeClass(buckets),
      errorResponseBuilder: (_request, context) => rateLimited(context.ttl),
    });
  },
  { name: 'bemmoly-rate-limiting', fastify: '5.x' },
);
