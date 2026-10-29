import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { idParamsSchema } from '../../../shared/common.ts';
import { createLevelBodySchema, updateLevelBodySchema } from '../../../shared/levels.ts';
import type { LevelsService } from '../services/levels/index.ts';

const idOf = (request: FastifyRequest) => parseOrThrow(idParamsSchema, request.params).id;

export function createLevelsController(service: LevelsService) {
  return {
    async list() {
      return { items: await service.list() };
    },
    async create(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(createLevelBodySchema, request.body);
      reply.code(201);
      return service.create(contextOf(request), body);
    },
    async update(request: FastifyRequest) {
      const body = parseOrThrow(updateLevelBodySchema, request.body);
      return service.update(contextOf(request), idOf(request), body);
    },
    async remove(request: FastifyRequest, reply: FastifyReply) {
      await service.remove(contextOf(request), idOf(request));
      reply.code(204);
    },
  };
}

export type LevelsController = ReturnType<typeof createLevelsController>;
