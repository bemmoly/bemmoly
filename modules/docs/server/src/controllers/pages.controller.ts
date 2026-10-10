import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { pageIdParamsSchema } from '../../../shared/common.ts';
import {
  createPageBodySchema,
  getPageQuerySchema,
  listTrashQuerySchema,
  updatePageBodySchema,
  type PageDetail,
  type PageSummaryPage,
} from '../../../shared/pages.ts';
import type { PagesService } from '../services/pages/index.ts';
import { spaceRefOf } from './spaces.controller.ts';

export const pageIdOf = (request: FastifyRequest) =>
  parseOrThrow(pageIdParamsSchema, request.params).pageId;

export function createPagesController(service: PagesService) {
  return {
    async create(request: FastifyRequest, reply: FastifyReply): Promise<PageDetail> {
      const body = parseOrThrow(createPageBodySchema, request.body);
      reply.code(201);
      return service.create(contextOf(request), body);
    },
    async get(request: FastifyRequest): Promise<PageDetail> {
      const query = parseOrThrow(getPageQuerySchema, request.query);
      return service.get(contextOf(request), pageIdOf(request), query);
    },
    async update(request: FastifyRequest): Promise<PageDetail> {
      const body = parseOrThrow(updatePageBodySchema, request.body);
      return service.update(contextOf(request), pageIdOf(request), body);
    },
    async remove(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      await service.remove(contextOf(request), pageIdOf(request));
      reply.code(204);
    },
    async restore(request: FastifyRequest): Promise<PageDetail> {
      return service.restore(contextOf(request), pageIdOf(request));
    },
    async trash(request: FastifyRequest): Promise<PageSummaryPage> {
      const query = parseOrThrow(listTrashQuerySchema, request.query);
      return service.listTrash(contextOf(request), spaceRefOf(request), query);
    },
  };
}

export type PagesController = ReturnType<typeof createPagesController>;
