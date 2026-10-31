import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { adoptBodySchema } from '../../../shared/adoption.ts';
import { applyCopyBodySchema, copyPlanQuerySchema } from '../../../shared/config-copy.ts';
import { environmentKeyParamsSchema } from '../../../shared/environments.ts';
import type { AdoptionService } from '../services/adoption/index.ts';
import type { ConfigCopyService } from '../services/config-copy/index.ts';

/** Adopting an environment's running services, and copying configuration into one. */
export function createAdoptionController(adoption: AdoptionService, copies: ConfigCopyService) {
  return {
    plan(request: FastifyRequest) {
      const { key } = parseOrThrow(environmentKeyParamsSchema, request.params);
      return adoption.plan(contextOf(request), key);
    },
    async adopt(request: FastifyRequest, reply: FastifyReply) {
      const { key } = parseOrThrow(environmentKeyParamsSchema, request.params);
      const body = parseOrThrow(adoptBodySchema, request.body);
      const result = await adoption.adopt(contextOf(request), key, body);
      reply.code(201);
      return result;
    },
    copyPlan(request: FastifyRequest) {
      const { key } = parseOrThrow(environmentKeyParamsSchema, request.params);
      const query = parseOrThrow(copyPlanQuerySchema, request.query);
      return copies.plan(contextOf(request), key, query);
    },
    async copy(request: FastifyRequest, reply: FastifyReply) {
      const { key } = parseOrThrow(environmentKeyParamsSchema, request.params);
      const body = parseOrThrow(applyCopyBodySchema, request.body);
      const result = await copies.apply(contextOf(request), key, body);
      reply.code(201);
      return result;
    },
  };
}

export type AdoptionController = ReturnType<typeof createAdoptionController>;
