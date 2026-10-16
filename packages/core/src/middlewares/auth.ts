import { ForbiddenError, UnauthenticatedError, type ApiTokenScope } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { Database } from '../clients/drizzle.ts';
import type { AuthenticateRequest } from '../contracts/authn.ts';
import type { Actor } from '../contracts/authz.ts';
import {
  createRequestAuthorization,
  type AuthorizationCache,
  type ModuleCatalog,
  type RequestAuthorization,
} from '../services/authz/index.ts';
import {
  authenticateApiToken,
  authenticateSession,
  PERSONAL_TOKEN_PREFIX,
} from '../services/identity/index.ts';
import { ACCESS_TOKEN_PREFIX } from '../services/oauth/index.ts';
import {
  clearSessionCookie,
  cookiePolicyFor,
  readCookie,
  serializeSessionCookie,
  SESSION_COOKIE,
  type CookiePolicy,
} from '../utils/session-cookie.ts';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by the auth middleware; null on anonymous requests. */
    actor: Actor | null;
    /** Per-request authorization with its own cache. */
    authz: RequestAuthorization | null;
    /** The session behind a cookie-authenticated request. */
    sessionId: string | null;
    /** Scopes of the API token behind a Bearer request. */
    tokenScopes: readonly ApiTokenScope[] | null;
    /** The modules the API token behind a Bearer request is limited to; null for all. */
    tokenModules: readonly string[] | null;
    /** A session cookie or API token was looked up and refused; the rate limiter counts these. */
    credentialRejected: boolean;
  }
  interface FastifyContextConfig {
    /** Marks a route anonymous by design; every other API route requires a signed-in actor. */
    anonymous?: boolean;
  }
}

export interface AuthenticationOptions {
  db: Database;
  modules: ModuleCatalog;
  publicUrl: string;
  /** Requests under this prefix are authenticated unless the route is anonymous. */
  apiPrefix?: string;
  /**
   * Paths under the prefix that are anonymous by design but registered without
   * `config.anonymous`; defaults to the email unsubscribe links.
   */
  anonymousPaths?: readonly string[];
  now?: () => Date;
  /**
   * The process-wide authorization cache (the server passes processAuthorizationCache). Absent:
   * every request reads roles, memberships, grants and tokens from the database.
   */
  authzCache?: AuthorizationCache;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const BEARER = /^Bearer\s+(\S+)$/i;
const KERNEL_TOKEN_PREFIXES = [PERSONAL_TOKEN_PREFIX, ACCESS_TOKEN_PREFIX];

/** A Bearer carrying one of Bemmoly's own tokens: a personal access token or an OAuth one. */
function isKernelBearer(header: string): boolean {
  const token = BEARER.exec(header)?.[1] ?? '';
  return KERNEL_TOKEN_PREFIXES.some((prefix) => token.startsWith(prefix));
}

/** Signed links in emails carry their own token instead of a session. */
export const DEFAULT_ANONYMOUS_PATHS: readonly string[] = ['/email-unsubscriptions'];

const pathOf = (request: FastifyRequest) => request.url.split('?')[0] ?? '';

function isUnderApi(request: FastifyRequest, apiPrefix: string): boolean {
  const path = pathOf(request);
  return path === apiPrefix || path.startsWith(`${apiPrefix}/`);
}

function requiresActor(
  request: FastifyRequest,
  apiPrefix: string,
  anonymousPaths: readonly string[],
): boolean {
  if (!isUnderApi(request, apiPrefix) || request.routeOptions.config?.anonymous === true) {
    return false;
  }
  return !anonymousPaths.some((anonymous) => pathOf(request) === `${apiPrefix}${anonymous}`);
}

/**
 * The actor the authentication middleware resolved, or a 401. For routes that
 * authenticate explicitly; needs `authentication` registered on the app.
 */
export const authenticateRequest: AuthenticateRequest = async (request) => {
  if (request.actor) return request.actor;
  throw new UnauthenticatedError();
};

/**
 * The person behind the request's actor (the user of a session, or the owner
 * of an API token), for the request summary log line; undefined when anonymous.
 */
export function requestUserId(request: FastifyRequest): string | undefined {
  const actor = request.actor;
  if (!actor) return undefined;
  return actor.kind === 'user' ? actor.id : actor.userId;
}

async function fromBearer(
  request: FastifyRequest,
  header: string,
  options: AuthenticationOptions,
  now: Date,
) {
  const token = BEARER.exec(header)?.[1];
  if (!token) throw new UnauthenticatedError('Send API tokens as "Authorization: Bearer <token>"');
  const resolved = await authenticateApiToken(options.db, token, now, options.authzCache);
  if (!resolved) {
    request.credentialRejected = true;
    throw new UnauthenticatedError('The API token is invalid, expired or revoked');
  }
  if (!resolved.scopes.includes('write') && !SAFE_METHODS.has(request.method)) {
    throw new ForbiddenError('This API token is read-only');
  }
  request.actor = { kind: 'api_token', id: resolved.tokenId, userId: resolved.userId };
  request.tokenScopes = resolved.scopes;
  request.tokenModules = resolved.modules;
  if (resolved.modules) {
    request.authz = createRequestAuthorization({
      db: options.db,
      modules: options.modules,
      restrictModules: resolved.modules,
      ...(options.authzCache ? { shared: options.authzCache } : {}),
    });
  }
}

async function fromCookie(
  request: FastifyRequest,
  reply: FastifyReply,
  token: string,
  options: AuthenticationOptions,
  policy: CookiePolicy,
  now: Date,
) {
  const userAgent = request.headers['user-agent'];
  const session = await authenticateSession(options.db, token, { ip: request.ip, userAgent }, now);
  if (!session) {
    request.credentialRejected = true;
    reply.header('set-cookie', clearSessionCookie(policy));
    return;
  }
  request.actor = { kind: 'user', id: session.userId };
  request.sessionId = session.sessionId;
  if (session.reissue) {
    const value = session.reissue.token ?? token;
    reply.header(
      'set-cookie',
      serializeSessionCookie(value, session.reissue.expiresAt, policy, now),
    );
  }
}

/**
 * Resolves the actor from a Bearer API token or the session cookie, never a
 * token sent as a cookie. Bearer wins when both are present. API routes are
 * closed unless marked `config: { anonymous: true }`.
 */
export const authentication = fp<AuthenticationOptions>(
  async (app, options) => {
    const policy = cookiePolicyFor(options.publicUrl);
    const apiPrefix = options.apiPrefix ?? '/api/v1';
    const anonymousPaths = options.anonymousPaths ?? DEFAULT_ANONYMOUS_PATHS;
    app.decorateRequest('actor', null);
    app.decorateRequest('authz', null);
    app.decorateRequest('sessionId', null);
    app.decorateRequest('tokenScopes', null);
    app.decorateRequest('tokenModules', null);
    app.decorateRequest('credentialRejected', false);
    app.addHook('onRequest', async (request, reply) => {
      const now = options.now ? options.now() : new Date();
      request.authz = createRequestAuthorization({
        db: options.db,
        modules: options.modules,
        ...(options.authzCache ? { shared: options.authzCache } : {}),
      });
      // Outside the API prefix a Bearer header belongs to that route's own scheme (the
      // /metrics scrape token). On a route anonymous by design, only Bemmoly's own tokens are
      // read here; anything else (a runner's pool token, a CI system's OIDC token) is left
      // for the route to check itself.
      const raw = isUnderApi(request, apiPrefix) ? request.headers.authorization : undefined;
      const anonymousRoute = request.routeOptions.config?.anonymous === true;
      const header =
        raw !== undefined && (!anonymousRoute || isKernelBearer(raw)) ? raw : undefined;
      const cookie = readCookie(request.headers.cookie, SESSION_COOKIE);
      if (header !== undefined) await fromBearer(request, header, options, now);
      else if (cookie) await fromCookie(request, reply, cookie, options, policy, now);
      if (!request.actor && requiresActor(request, apiPrefix, anonymousPaths)) {
        throw new UnauthenticatedError();
      }
    });
  },
  { name: 'bemmoly-authentication', fastify: '5.x' },
);
