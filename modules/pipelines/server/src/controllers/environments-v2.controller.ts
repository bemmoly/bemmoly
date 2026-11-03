import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  applySuggestedSetupBodySchema,
  createEnvironmentV2BodySchema,
  environmentIdSchema,
  reorderEnvironmentsBodySchema,
  updateEnvironmentV2BodySchema,
} from '../../../shared/environments-v2.ts';
import type { EnvironmentsV2Service } from '../services/environments-v2/index.ts';

const keyParamsSchema = z.object({ key: environmentIdSchema });

/** Equal environments on one ordered path, and the suggested setup. */
export function createEnvironmentsV2Controller(service: EnvironmentsV2Service) {
  const keyOf = (request: FastifyRequest) => parseOrThrow(keyParamsSchema, request.params).key;
  return {
    list: (request: FastifyRequest) => service.list(contextOf(request)),
    async create(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(createEnvironmentV2BodySchema, request.body);
      const created = await service.create(contextOf(request), body);
      reply.code(201);
      return created;
    },
    update(request: FastifyRequest) {
      const body = parseOrThrow(updateEnvironmentV2BodySchema, request.body);
      return service.update(contextOf(request), keyOf(request), body);
    },
    async remove(request: FastifyRequest, reply: FastifyReply) {
      await service.remove(contextOf(request), keyOf(request));
      reply.code(204);
    },
    reorder(request: FastifyRequest) {
      const body = parseOrThrow(reorderEnvironmentsBodySchema, request.body);
      return service.reorder(contextOf(request), body);
    },
    async applySuggested(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(applySuggestedSetupBodySchema, request.body);
      const applied = await service.applySuggested(contextOf(request), body);
      reply.code(201);
      return applied;
    },
  };
}

export type EnvironmentsV2Controller = ReturnType<typeof createEnvironmentsV2Controller>;
