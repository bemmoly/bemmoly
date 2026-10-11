import {
  createScimTokenSchema,
  createSsoProviderSchema,
  idParamsSchema,
  parseOrThrow,
  updateSsoPolicySchema,
  updateSsoProviderSchema,
  type CreatedScimToken,
  type ScimTokensResponse,
  type SsoPolicy,
  type SsoProvider,
  type SsoProvidersResponse,
  type SsoTestStarted,
} from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { createScimToken, listScimTokens, revokeScimToken } from '../services/scim/index.ts';
import {
  createSsoProvider,
  deleteSsoProvider,
  getSsoPolicy,
  getSsoProvider,
  listSsoProviders,
  scimBaseUrl,
  startTest,
  updateSsoPolicy,
  updateSsoProvider,
  type SsoDependencies,
} from '../services/sso/index.ts';
import { cookiePolicyFor } from '../utils/session-cookie.ts';
import { serializeSsoCookie } from '../utils/sso-cookie.ts';
import { contextOf } from './request-context.ts';

/** Settings › Sign-in: identity providers, the require-SSO policy and SCIM tokens. */
export function createSsoAdminController(deps: SsoDependencies) {
  const { db, publicUrl } = deps;
  const policy = cookiePolicyFor(publicUrl);
  return {
    async listProviders(request: FastifyRequest): Promise<SsoProvidersResponse> {
      return { items: await listSsoProviders(deps, contextOf(request)) };
    },

    async getProvider(request: FastifyRequest): Promise<SsoProvider> {
      const { id } = parseOrThrow(idParamsSchema, request.params);
      return getSsoProvider(deps, contextOf(request), id);
    },

    async createProvider(request: FastifyRequest, reply: FastifyReply): Promise<SsoProvider> {
      const input = parseOrThrow(createSsoProviderSchema, request.body);
      const created = await createSsoProvider(deps, contextOf(request), input);
      reply.code(201);
      return created;
    },

    async updateProvider(request: FastifyRequest): Promise<SsoProvider> {
      const { id } = parseOrThrow(idParamsSchema, request.params);
      const input = parseOrThrow(updateSsoProviderSchema, request.body);
      return updateSsoProvider(deps, contextOf(request), id, input);
    },

    async deleteProvider(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const { id } = parseOrThrow(idParamsSchema, request.params);
      await deleteSsoProvider(deps, contextOf(request), id);
      reply.code(204).send();
    },

    /** Sets the binding cookie on this browser; the page then opens the returned URL. */
    async startTest(request: FastifyRequest, reply: FastifyReply): Promise<SsoTestStarted> {
      const { id } = parseOrThrow(idParamsSchema, request.params);
      const started = await startTest(deps, contextOf(request), id);
      reply.header(
        'set-cookie',
        serializeSsoCookie(started.binding.token, started.binding.expiresAt, policy),
      );
      reply.header('cache-control', 'no-store');
      reply.code(201);
      return { authorizationUrl: started.redirectUrl };
    },

    async getPolicy(request: FastifyRequest): Promise<SsoPolicy> {
      return getSsoPolicy(db, contextOf(request));
    },

    async updatePolicy(request: FastifyRequest): Promise<SsoPolicy> {
      const input = parseOrThrow(updateSsoPolicySchema, request.body);
      return updateSsoPolicy(db, contextOf(request), input);
    },

    async listScimTokens(request: FastifyRequest): Promise<ScimTokensResponse> {
      return {
        items: await listScimTokens(db, contextOf(request)),
        baseUrl: scimBaseUrl(publicUrl),
      };
    },

    async createScimToken(request: FastifyRequest, reply: FastifyReply): Promise<CreatedScimToken> {
      const input = parseOrThrow(createScimTokenSchema, request.body);
      const created = await createScimToken(db, contextOf(request), input);
      reply.code(201).header('cache-control', 'no-store');
      return created;
    },

    async revokeScimToken(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const { id } = parseOrThrow(idParamsSchema, request.params);
      await revokeScimToken(db, contextOf(request), id);
      reply.code(204).send();
    },
  };
}

export type SsoAdminController = ReturnType<typeof createSsoAdminController>;
