import {
  createOAuthConsentSchema,
  idParamsSchema,
  moduleIdSchema,
  oauthAuthorizeRequestSchema,
  oauthRevokeRequestSchema,
  oauthTokenRequestSchema,
  parseOrThrow,
  type OAuthAuthorizationPreview,
  type OAuthConsentResult,
  type OAuthGrantsResponse,
} from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { OAuthProtocolError, type OAuthService } from '../services/oauth/index.ts';
import { contextOf } from './request-context.ts';

const resourceParamsSchema = z.object({ moduleId: moduleIdSchema.optional() });
const GRANT_TYPES = ['authorization_code', 'refresh_token'];

/** OAuth answers are never cached: they carry tokens, or say why there are none. */
function noStore(reply: FastifyReply) {
  reply.header('cache-control', 'no-store').header('pragma', 'no-cache');
}

/** Every client is public here; one that tries to authenticate was registered elsewhere. */
function assertPublicClient(request: FastifyRequest, form: Record<string, unknown>) {
  if (request.headers.authorization || form['client_secret'] !== undefined) {
    throw new OAuthProtocolError(
      'invalid_client',
      'This server issues no client secrets; send client_id only',
      401,
    );
  }
}

function formOf(request: FastifyRequest): Record<string, unknown> {
  return request.body && typeof request.body === 'object'
    ? (request.body as Record<string, unknown>)
    : {};
}

/**
 * The authorization server's HTTP surface. The token and revocation endpoints answer in
 * OAuth's own error shape (RFC 6749 5.2), which clients parse, so they write their status
 * themselves; the consent and connected-app endpoints are ordinary session API routes.
 */
export function createOAuthController(service: OAuthService) {
  /** Runs an OAuth endpoint, answering its protocol errors as the RFC says. */
  async function protocol<T>(request: FastifyRequest, reply: FastifyReply, run: () => Promise<T>) {
    noStore(reply);
    try {
      return await run();
    } catch (error) {
      if (!(error instanceof OAuthProtocolError)) throw error;
      if (error.error === 'invalid_grant' || error.error === 'invalid_client') {
        request.credentialRejected = true;
      }
      if (error.status === 401) reply.header('www-authenticate', 'Basic realm="bemmoly"');
      return reply.code(error.status).send(error.toBody());
    }
  }

  return {
    authorizationServer: () => service.authorizationServerMetadata(),

    protectedResource(request: FastifyRequest) {
      const { moduleId } = parseOrThrow(resourceParamsSchema, request.params);
      return service.protectedResourceMetadata(moduleId);
    },

    token: (request: FastifyRequest, reply: FastifyReply) =>
      protocol(request, reply, async () => {
        const form = formOf(request);
        assertPublicClient(request, form);
        if (typeof form['grant_type'] !== 'string' || !GRANT_TYPES.includes(form['grant_type'])) {
          throw new OAuthProtocolError(
            'unsupported_grant_type',
            'Use authorization_code or refresh_token',
          );
        }
        const parsed = oauthTokenRequestSchema.safeParse(form);
        if (!parsed.success) {
          throw new OAuthProtocolError('invalid_request', 'The token request is missing a field');
        }
        return service.token(parsed.data);
      }),

    revoke: (request: FastifyRequest, reply: FastifyReply) =>
      protocol(request, reply, async () => {
        const form = formOf(request);
        assertPublicClient(request, form);
        const parsed = oauthRevokeRequestSchema.safeParse(form);
        if (!parsed.success) {
          throw new OAuthProtocolError('invalid_request', 'Send the token to revoke');
        }
        await service.revoke(parsed.data);
        return reply.code(200).send();
      }),

    async preview(request: FastifyRequest): Promise<OAuthAuthorizationPreview> {
      const query = parseOrThrow(oauthAuthorizeRequestSchema, request.query);
      return service.preview(contextOf(request), query);
    },

    async decide(request: FastifyRequest, reply: FastifyReply): Promise<OAuthConsentResult> {
      const input = parseOrThrow(createOAuthConsentSchema, request.body);
      const result = await service.decide(contextOf(request), input);
      reply.code(201).header('cache-control', 'no-store');
      return result;
    },

    async listGrants(request: FastifyRequest): Promise<OAuthGrantsResponse> {
      return { items: await service.listGrants(contextOf(request)) };
    },

    async revokeGrant(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const { id } = parseOrThrow(idParamsSchema, request.params);
      await service.revokeGrant(contextOf(request), id);
      reply.code(204).send();
    },
  };
}

export type OAuthController = ReturnType<typeof createOAuthController>;
