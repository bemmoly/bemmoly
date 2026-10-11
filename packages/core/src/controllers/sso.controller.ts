import {
  idParamsSchema,
  NotFoundError,
  oidcCallbackQuerySchema,
  parseOrThrow,
  samlCallbackBodySchema,
  ssoCompleteQuerySchema,
  ssoStartQuerySchema,
  type SsoFailureReason,
  type SsoSignInOptionsResponse,
} from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { appLink } from '../services/identity/index.ts';
import {
  acceptSamlResponse,
  completeSaml,
  finishOidc,
  listSignInOptions,
  loadProvider,
  serviceProviderMetadata,
  serviceProviderUrls,
  SsoFailure,
  startSignIn,
  type FlowOutcome,
  type SsoDependencies,
} from '../services/sso/index.ts';
import { cookiePolicyFor, readCookie } from '../utils/session-cookie.ts';
import { clearSsoCookie, serializeSsoCookie, SSO_BINDING_COOKIE } from '../utils/sso-cookie.ts';
import { clientOf, setSessionCookie } from './request-context.ts';

/** The sign-in page, with the closed reason the page explains. Never any other detail. */
const loginWith = (publicUrl: string, reason: SsoFailureReason) =>
  appLink(publicUrl, `/login?sso_error=${reason}`);

/**
 * The browser side of single sign-on. Every answer is a redirect: a browser follows these, so
 * failures land on the sign-in page with a reason instead of a JSON error body.
 */
export function createSsoController(deps: SsoDependencies) {
  const { publicUrl } = deps;
  const policy = cookiePolicyFor(publicUrl);

  /** Logs the exact failure and sends the browser to the sign-in page with its reason. */
  function failed(request: FastifyRequest, reply: FastifyReply, error: unknown): FastifyReply {
    if (!(error instanceof SsoFailure)) throw error;
    request.log.info({ reason: error.reason, err: error }, 'single sign-on refused');
    reply.header('set-cookie', clearSsoCookie(policy));
    return reply.redirect(loginWith(publicUrl, error.reason), 303);
  }

  function landed(reply: FastifyReply, outcome: FlowOutcome): FastifyReply {
    reply.header('set-cookie', clearSsoCookie(policy));
    if (outcome.kind === 'signed_in') setSessionCookie(reply, publicUrl, outcome.session);
    return reply.redirect(appLink(publicUrl, outcome.returnTo), 303);
  }

  const clientWithSession = (request: FastifyRequest) => ({
    ...clientOf(request),
    previousSessionId: request.sessionId ?? undefined,
  });

  return {
    async signInOptions(): Promise<SsoSignInOptionsResponse> {
      return listSignInOptions(deps.db);
    },

    async start(request: FastifyRequest, reply: FastifyReply) {
      const { id } = parseOrThrow(idParamsSchema, request.params);
      const query = parseOrThrow(ssoStartQuerySchema, request.query ?? {});
      try {
        const started = await startSignIn(deps, id, query);
        reply.header(
          'set-cookie',
          serializeSsoCookie(started.binding.token, started.binding.expiresAt, policy),
        );
        reply.header('cache-control', 'no-store');
        return reply.redirect(started.redirectUrl, 303);
      } catch (error) {
        return failed(request, reply, error);
      }
    },

    async oidcCallback(request: FastifyRequest, reply: FastifyReply) {
      const { id } = parseOrThrow(idParamsSchema, request.params);
      const query = parseOrThrow(oidcCallbackQuerySchema, request.query ?? {});
      const binding = readCookie(request.headers.cookie, SSO_BINDING_COOKIE);
      try {
        return landed(
          reply,
          await finishOidc(deps, id, query, binding, clientWithSession(request)),
        );
      } catch (error) {
        return failed(request, reply, error);
      }
    },

    async samlCallback(request: FastifyRequest, reply: FastifyReply) {
      const { id } = parseOrThrow(idParamsSchema, request.params);
      const body = samlCallbackBodySchema.safeParse(request.body);
      if (!body.success) {
        return failed(
          request,
          reply,
          new SsoFailure('invalid_response', 'The SAML POST is malformed'),
        );
      }
      try {
        return reply.redirect(await acceptSamlResponse(deps, id, body.data), 303);
      } catch (error) {
        return failed(request, reply, error);
      }
    },

    async complete(request: FastifyRequest, reply: FastifyReply) {
      const query = ssoCompleteQuerySchema.safeParse(request.query ?? {});
      const binding = readCookie(request.headers.cookie, SSO_BINDING_COOKIE);
      try {
        if (!query.success)
          throw new SsoFailure('state_mismatch', 'The hand-over carried no state');
        return landed(
          reply,
          await completeSaml(deps, query.data.state, binding, clientWithSession(request)),
        );
      } catch (error) {
        return failed(request, reply, error);
      }
    },

    async metadata(request: FastifyRequest, reply: FastifyReply): Promise<string> {
      const { id } = parseOrThrow(idParamsSchema, request.params);
      const provider = await loadProvider(deps.db, deps.secrets, id);
      if (provider.protocol !== 'saml') throw new NotFoundError('This provider does not use SAML');
      reply.type('application/samlmetadata+xml');
      return serviceProviderMetadata(serviceProviderUrls(publicUrl, id));
    },
  };
}

export type SsoController = ReturnType<typeof createSsoController>;
