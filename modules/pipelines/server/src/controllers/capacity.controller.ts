import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  capacityQuerySchema,
  createPoolBodySchema,
  poolKeyParamsSchema,
  poolShareParamsSchema,
  teamShareBodySchema,
  updatePoolBodySchema,
} from '../../../shared/capacity.ts';
import type { CapacityService } from '../services/capacity/index.ts';

/** Platform › Capacity: pools, tokens and fair-share weights under /api/v1/pipelines. */
export function createCapacityController(service: CapacityService) {
  return {
    read(request: FastifyRequest) {
      return service.read(contextOf(request), parseOrThrow(capacityQuerySchema, request.query));
    },
    pools: (request: FastifyRequest) => service.pools(contextOf(request)),
    async create(request: FastifyRequest, reply: FastifyReply) {
      const created = await service.create(
        contextOf(request),
        parseOrThrow(createPoolBodySchema, request.body ?? {}),
      );
      reply.code(201);
      return created;
    },
    update(request: FastifyRequest) {
      const { key } = parseOrThrow(poolKeyParamsSchema, request.params);
      return service.update(
        contextOf(request),
        key,
        parseOrThrow(updatePoolBodySchema, request.body ?? {}),
      );
    },
    async rotate(request: FastifyRequest, reply: FastifyReply) {
      const { key } = parseOrThrow(poolKeyParamsSchema, request.params);
      const token = await service.rotateToken(contextOf(request), key);
      reply.code(201);
      return token;
    },
    share(request: FastifyRequest) {
      const { key, teamId } = parseOrThrow(poolShareParamsSchema, request.params);
      return service.setShare(
        contextOf(request),
        key,
        teamId,
        parseOrThrow(teamShareBodySchema, request.body ?? {}),
      );
    },
  };
}

export type CapacityController = ReturnType<typeof createCapacityController>;
