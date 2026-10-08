import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { createFieldBodySchema, updateFieldBodySchema } from '../../../shared/issue-types.ts';
import type { FieldsService } from '../services/fields/index.ts';
import { idOf, scopeOf } from './types.controller.ts';

export function createFieldsController(service: FieldsService) {
  return {
    async list(request: FastifyRequest) {
      return service.list(contextOf(request), scopeOf(request));
    },
    async create(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(createFieldBodySchema, request.body);
      reply.code(201);
      return service.create(contextOf(request), scopeOf(request), body);
    },
    async update(request: FastifyRequest) {
      const body = parseOrThrow(updateFieldBodySchema, request.body);
      return service.update(contextOf(request), scopeOf(request), idOf(request), body);
    },
    async remove(request: FastifyRequest, reply: FastifyReply) {
      await service.remove(contextOf(request), scopeOf(request), idOf(request));
      reply.code(204);
    },
  };
}

export type FieldsController = ReturnType<typeof createFieldsController>;
