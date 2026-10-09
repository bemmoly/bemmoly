import { contextOf } from '@bemmoly/core';
import { idParamsSchema, parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  createIssueTypeBodySchema,
  putIssueTypeFieldsBodySchema,
  reorderIssueTypesBodySchema,
  updateIssueTypeBodySchema,
} from '../../../shared/issue-types.ts';
import { projectRefParamsSchema } from '../../../shared/boards.ts';
import type { IssueTypesService } from '../services/types/index.ts';

/** The same handlers serve /issue-types and /projects/:key/issue-types; the key or id decides the scope. */
export const scopeOf = (request: FastifyRequest): string | null => {
  const params = request.params as { key?: string };
  return params.key ? parseOrThrow(projectRefParamsSchema, params).key : null;
};

export const idOf = (request: FastifyRequest) => parseOrThrow(idParamsSchema, request.params).id;

export function createTypesController(service: IssueTypesService) {
  return {
    async list(request: FastifyRequest) {
      return service.list(contextOf(request), scopeOf(request));
    },
    async create(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(createIssueTypeBodySchema, request.body);
      reply.code(201);
      return service.create(contextOf(request), scopeOf(request), body);
    },
    async update(request: FastifyRequest) {
      const body = parseOrThrow(updateIssueTypeBodySchema, request.body);
      return service.update(contextOf(request), scopeOf(request), idOf(request), body);
    },
    async reorder(request: FastifyRequest) {
      const body = parseOrThrow(reorderIssueTypesBodySchema, request.body);
      return service.reorder(contextOf(request), scopeOf(request), body);
    },
    async remove(request: FastifyRequest, reply: FastifyReply) {
      await service.remove(contextOf(request), scopeOf(request), idOf(request));
      reply.code(204);
    },
    async layout(request: FastifyRequest) {
      return service.layout(contextOf(request), scopeOf(request), idOf(request));
    },
    async putLayout(request: FastifyRequest) {
      const body = parseOrThrow(putIssueTypeFieldsBodySchema, request.body);
      return service.putLayout(contextOf(request), scopeOf(request), idOf(request), body);
    },
  };
}

export type TypesController = ReturnType<typeof createTypesController>;
