import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  createSavedViewBodySchema,
  listSavedViewsQuerySchema,
  savedViewParamsSchema,
} from '../../../shared/saved-views.ts';
import type { ViewsService } from '../services/views/index.ts';

/** A person's saved views of the catalog, runs and releases. */
export function createViewsController(service: ViewsService) {
  return {
    list(request: FastifyRequest) {
      const { screen } = parseOrThrow(listSavedViewsQuerySchema, request.query);
      return service.list(contextOf(request), screen);
    },
    async create(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(createSavedViewBodySchema, request.body);
      const view = await service.create(contextOf(request), body);
      reply.code(201);
      return view;
    },
    async remove(request: FastifyRequest, reply: FastifyReply) {
      const { id } = parseOrThrow(savedViewParamsSchema, request.params);
      await service.remove(contextOf(request), id);
      reply.code(204);
    },
  };
}

export type ViewsController = ReturnType<typeof createViewsController>;
