import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { OAuthController } from '../controllers/oauth.controller.ts';
import {
  AS_METADATA_PATH,
  RESOURCE_METADATA_PATH,
  REVOKE_PATH,
  TOKEN_PATH,
} from '../services/oauth/index.ts';

export interface OAuthRateLimit {
  max: number;
  windowMs: number;
}

/** Per address: a client refreshes once an hour; discovery is a handful of reads per connect. */
export const DEFAULT_OAUTH_RATE_LIMIT: OAuthRateLimit = { max: 60, windowMs: 60_000 };
/** Per person: every consent screen may fetch a client's metadata document once. */
const CONSENT_RATE_LIMIT = { max: 30, windowMs: 60_000 };
/** Token requests are a few fields; a large body is not one. */
const FORM_BODY_LIMIT = 16 * 1024;

/**
 * The authorization server at the root, beside /mcp, as RFC 8414 and RFC 9728 place it.
 * Anonymous by design: discovery is public, and the token and revocation endpoints are called
 * by native and web clients from anywhere (they are not cookie-authenticated, so they opt out of
 * the Origin check; a code needs its PKCE verifier, a refresh token is itself the credential).
 */
export function oauthServerRoutes(
  controller: OAuthController,
  limit: OAuthRateLimit = DEFAULT_OAUTH_RATE_LIMIT,
): FastifyPluginAsync {
  return async (app) => {
    app.addContentTypeParser(
      'application/x-www-form-urlencoded',
      { parseAs: 'string', bodyLimit: FORM_BODY_LIMIT },
      (_request, body, done) => {
        done(null, Object.fromEntries(new URLSearchParams(String(body))));
      },
    );
    const rateLimit = {
      max: limit.max,
      timeWindow: limit.windowMs,
      keyGenerator: (request: FastifyRequest) => `oauth|ip:${request.ip}`,
    };
    const read = { config: { rateLimit } };
    const form = { config: { rateLimit, crossSiteForm: true }, bodyLimit: FORM_BODY_LIMIT };

    app.get(AS_METADATA_PATH, read, async () => controller.authorizationServer());
    app.get(RESOURCE_METADATA_PATH, read, async (r) => controller.protectedResource(r));
    app.get(`${RESOURCE_METADATA_PATH}/mcp`, read, async (r) => controller.protectedResource(r));
    app.get(`${RESOURCE_METADATA_PATH}/mcp/:moduleId`, read, async (r) =>
      controller.protectedResource(r),
    );
    app.post(TOKEN_PATH, form, async (r, reply) => controller.token(r, reply));
    app.post(REVOKE_PATH, form, async (r, reply) => controller.revoke(r, reply));
  };
}

/**
 * The consent screen and Connected apps, for the signed-in person (a session, not a token: the
 * services refuse anything else). Previews may fetch a client's metadata document, so they
 * have a tighter per-person budget than the rest of the API.
 */
export function oauthApiRoutes(controller: OAuthController): FastifyPluginAsync {
  return async (app) => {
    const consent = {
      config: {
        rateLimit: {
          max: CONSENT_RATE_LIMIT.max,
          timeWindow: CONSENT_RATE_LIMIT.windowMs,
          keyGenerator: (request: FastifyRequest) =>
            `oauth-consent|${request.actor?.userId ?? request.actor?.id ?? `ip:${request.ip}`}`,
        },
      },
    };
    app.get('/oauth/authorization-requests', consent, async (r) => controller.preview(r));
    app.post('/oauth/consents', consent, async (r, reply) => controller.decide(r, reply));
    app.get('/oauth/grants', async (r) => controller.listGrants(r));
    app.delete('/oauth/grants/:id', async (r, reply) => controller.revokeGrant(r, reply));
  };
}
