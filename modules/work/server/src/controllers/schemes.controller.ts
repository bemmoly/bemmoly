import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { projectRefParamsSchema } from '../../../shared/boards.ts';
import {
  schemeKindSchema,
  type SchemeDiff,
  type SchemesResponse,
} from '../../../shared/schemes.ts';
import type { SchemesService } from '../services/schemes/index.ts';

const kindParams = projectRefParamsSchema.extend({ kind: schemeKindSchema });

export function createSchemesController(service: SchemesService) {
  const scheme = (request: FastifyRequest) => parseOrThrow(kindParams, request.params);

  return {
    async list(request: FastifyRequest): Promise<SchemesResponse> {
      const { key } = parseOrThrow(projectRefParamsSchema, request.params);
      return service.list(contextOf(request), key);
    },
    async diff(request: FastifyRequest): Promise<SchemeDiff> {
      const { key, kind } = scheme(request);
      return service.diff(contextOf(request), key, kind);
    },
    async override(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const { key, kind } = scheme(request);
      await service.override(contextOf(request), key, kind);
      reply.code(204);
    },
    async reset(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const { key, kind } = scheme(request);
      await service.reset(contextOf(request), key, kind);
      reply.code(204);
    },
  };
}

export type SchemesController = ReturnType<typeof createSchemesController>;
