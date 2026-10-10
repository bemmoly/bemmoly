import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  compareRevisionsQuerySchema,
  createRevisionBodySchema,
  listRevisionsQuerySchema,
  revisionParamsSchema,
  type RevisionCompare,
  type RevisionDetail,
  type RevisionSummary,
  type RevisionsPage,
} from '../../../shared/revisions.ts';
import type { RevisionsService } from '../services/revisions/index.ts';
import { pageIdOf } from './pages.controller.ts';

const revisionOf = (request: FastifyRequest) => parseOrThrow(revisionParamsSchema, request.params);

export function createRevisionsController(service: RevisionsService) {
  return {
    async list(request: FastifyRequest): Promise<RevisionsPage> {
      const query = parseOrThrow(listRevisionsQuerySchema, request.query);
      return service.list(contextOf(request), pageIdOf(request), query);
    },
    async get(request: FastifyRequest): Promise<RevisionDetail> {
      const { pageId, revisionId } = revisionOf(request);
      return service.get(contextOf(request), pageId, revisionId);
    },
    async create(request: FastifyRequest, reply: FastifyReply): Promise<RevisionSummary> {
      const body = parseOrThrow(createRevisionBodySchema, request.body ?? {});
      reply.code(201);
      return service.create(contextOf(request), pageIdOf(request), body);
    },
    async restore(request: FastifyRequest): Promise<RevisionSummary> {
      const { pageId, revisionId } = revisionOf(request);
      return service.restore(contextOf(request), pageId, revisionId);
    },
    async compare(request: FastifyRequest): Promise<RevisionCompare> {
      const query = parseOrThrow(compareRevisionsQuerySchema, request.query);
      return service.compare(contextOf(request), pageIdOf(request), query);
    },
  };
}

export type RevisionsController = ReturnType<typeof createRevisionsController>;
