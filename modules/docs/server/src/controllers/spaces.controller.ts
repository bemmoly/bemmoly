import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { spaceRefParamsSchema } from '../../../shared/common.ts';
import {
  createSpaceBodySchema,
  listSpacesQuerySchema,
  updateSpaceBodySchema,
  type Space,
  type SpacesPage,
} from '../../../shared/spaces.ts';
import type { SpacesService } from '../services/spaces/index.ts';

/** The space's key, or its id: settings screens hold ids, links hold keys. */
export const spaceRefOf = (request: FastifyRequest) =>
  parseOrThrow(spaceRefParamsSchema, request.params).spaceKey;

export function createSpacesController(service: SpacesService) {
  return {
    async list(request: FastifyRequest): Promise<SpacesPage> {
      const query = parseOrThrow(listSpacesQuerySchema, request.query);
      return service.list(contextOf(request), query);
    },
    async get(request: FastifyRequest): Promise<Space> {
      return service.get(contextOf(request), spaceRefOf(request));
    },
    async create(request: FastifyRequest, reply: FastifyReply): Promise<Space> {
      const body = parseOrThrow(createSpaceBodySchema, request.body);
      reply.code(201);
      return service.create(contextOf(request), body);
    },
    async update(request: FastifyRequest): Promise<Space> {
      const body = parseOrThrow(updateSpaceBodySchema, request.body);
      return service.update(contextOf(request), spaceRefOf(request), body);
    },
    async remove(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      await service.remove(contextOf(request), spaceRefOf(request));
      reply.code(204);
    },
  };
}

export type SpacesController = ReturnType<typeof createSpacesController>;
