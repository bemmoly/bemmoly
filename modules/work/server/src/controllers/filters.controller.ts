import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  createSavedFilterBodySchema,
  listSavedFiltersQuerySchema,
  updateSavedFilterBodySchema,
  type SavedFilter,
} from '../../../shared/filters.ts';
import type { FiltersService } from '../services/filters/index.ts';

const idParams = z.object({ id: z.uuid() });

export function createFiltersController(service: FiltersService) {
  const id = (request: FastifyRequest) => parseOrThrow(idParams, request.params).id;

  return {
    async list(request: FastifyRequest): Promise<{ items: SavedFilter[] }> {
      const query = parseOrThrow(listSavedFiltersQuerySchema, request.query);
      return { items: await service.list(contextOf(request), query) };
    },
    async get(request: FastifyRequest): Promise<SavedFilter> {
      return service.get(contextOf(request), id(request));
    },
    async create(request: FastifyRequest, reply: FastifyReply): Promise<SavedFilter> {
      const body = parseOrThrow(createSavedFilterBodySchema, request.body);
      reply.code(201);
      return service.create(contextOf(request), body);
    },
    async update(request: FastifyRequest): Promise<SavedFilter> {
      const body = parseOrThrow(updateSavedFilterBodySchema, request.body);
      return service.update(contextOf(request), id(request), body);
    },
    async remove(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      await service.remove(contextOf(request), id(request));
      reply.code(204).send();
    },
  };
}

export type FiltersController = ReturnType<typeof createFiltersController>;
