import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  commentIdParamsSchema,
  createCommentBodySchema,
  listCommentsQuerySchema,
  updateCommentBodySchema,
  type CommentsResponse,
  type PageComment,
} from '../../../shared/comments.ts';
import type { CommentsService } from '../services/comments/index.ts';
import { pageIdOf } from './pages.controller.ts';

const commentIdOf = (request: FastifyRequest) =>
  parseOrThrow(commentIdParamsSchema, request.params).commentId;

export function createCommentsController(service: CommentsService) {
  return {
    async list(request: FastifyRequest): Promise<CommentsResponse> {
      const query = parseOrThrow(listCommentsQuerySchema, request.query);
      return service.list(contextOf(request), pageIdOf(request), query);
    },
    async create(request: FastifyRequest, reply: FastifyReply): Promise<PageComment> {
      const body = parseOrThrow(createCommentBodySchema, request.body);
      reply.code(201);
      return service.create(contextOf(request), pageIdOf(request), body);
    },
    async update(request: FastifyRequest): Promise<PageComment> {
      const body = parseOrThrow(updateCommentBodySchema, request.body);
      return service.update(contextOf(request), commentIdOf(request), body);
    },
    async remove(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      await service.remove(contextOf(request), commentIdOf(request));
      reply.code(204);
    },
    async resolve(request: FastifyRequest): Promise<PageComment> {
      return service.resolve(contextOf(request), commentIdOf(request));
    },
    async reopen(request: FastifyRequest): Promise<PageComment> {
      return service.reopen(contextOf(request), commentIdOf(request));
    },
    async applySuggestion(request: FastifyRequest): Promise<PageComment> {
      return service.applySuggestion(contextOf(request), commentIdOf(request));
    },
  };
}

export type CommentsController = ReturnType<typeof createCommentsController>;
