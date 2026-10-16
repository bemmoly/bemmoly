import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  ciIdParamsSchema,
  createCiIssuerBodySchema,
  createCiTokenBodySchema,
  createTrustRuleBodySchema,
  listExternalChecksQuerySchema,
  listTrustRulesQuerySchema,
} from '../../../shared/ci.ts';
import { registerReleaseBodySchema } from '../../../shared/releases.ts';
import type { CiService } from '../services/ci/index.ts';

const BEARER = /^Bearer\s+(\S+)$/i;

/** The server's own address as the request reached it: the audience CI tokens are for. */
function audiences(request: FastifyRequest): string[] {
  const origin = `${request.protocol}://${request.host}`;
  return [origin, `${origin}/`];
}

/** Bring your CI under /api/v1/pipelines: release registration and Platform › CI. */
export function createCiController(service: CiService) {
  return {
    async registerRelease(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(registerReleaseBodySchema, request.body);
      const bearer = BEARER.exec(request.headers.authorization ?? '')?.[1] ?? null;
      const principal = await service.principal(bearer, audiences(request));
      const result = await service.register({
        ctx: request.actor ? contextOf(request) : null,
        principal,
        body,
      });
      reply.code(result.created ? 201 : 200);
      return result.release;
    },
    async issuers(request: FastifyRequest) {
      return { items: await service.admin.issuers(contextOf(request)) };
    },
    async createIssuer(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(createCiIssuerBodySchema, request.body);
      const issuer = await service.admin.createIssuer(contextOf(request), body);
      reply.code(201);
      return issuer;
    },
    async removeIssuer(request: FastifyRequest, reply: FastifyReply) {
      const { id } = parseOrThrow(ciIdParamsSchema, request.params);
      await service.admin.removeIssuer(contextOf(request), id);
      reply.code(204);
    },
    async rules(request: FastifyRequest) {
      const { application } = parseOrThrow(listTrustRulesQuerySchema, request.query);
      return { items: await service.admin.rules(contextOf(request), application) };
    },
    async createRule(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(createTrustRuleBodySchema, request.body);
      const rule = await service.admin.createRule(contextOf(request), body);
      reply.code(201);
      return rule;
    },
    async removeRule(request: FastifyRequest, reply: FastifyReply) {
      const { id } = parseOrThrow(ciIdParamsSchema, request.params);
      await service.admin.removeRule(contextOf(request), id);
      reply.code(204);
    },
    async tokens(request: FastifyRequest) {
      return { items: await service.admin.tokens(contextOf(request)) };
    },
    async createToken(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(createCiTokenBodySchema, request.body);
      const token = await service.admin.createToken(contextOf(request), body);
      reply.code(201);
      return token;
    },
    async revokeToken(request: FastifyRequest, reply: FastifyReply) {
      const { id } = parseOrThrow(ciIdParamsSchema, request.params);
      await service.admin.revokeToken(contextOf(request), id);
      reply.code(204);
    },
    async checks(request: FastifyRequest) {
      const query = parseOrThrow(listExternalChecksQuerySchema, request.query);
      return { items: await service.checks(contextOf(request), query) };
    },
  };
}

export type CiController = ReturnType<typeof createCiController>;
