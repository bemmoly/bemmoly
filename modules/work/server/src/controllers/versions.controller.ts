import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  createVersionBodySchema,
  listVersionsQuerySchema,
  updateVersionBodySchema,
} from '../../../shared/versions-components.ts';
import type { VersionsService } from '../services/versions/index.ts';
import { keyOf } from './projects.controller.ts';
import { idOf } from './types.controller.ts';

/** A project's versions, at /projects/:key/versions; the list answers the pickers too. */
export function createVersionsController(service: VersionsService) {
  return {
    async list(request: FastifyRequest) {
      const query = parseOrThrow(listVersionsQuerySchema, request.query);
      return service.list(contextOf(request), keyOf(request), query);
    },
    async create(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(createVersionBodySchema, request.body);
      reply.code(201);
      return service.create(contextOf(request), keyOf(request), body);
    },
    async update(request: FastifyRequest) {
      const body = parseOrThrow(updateVersionBodySchema, request.body);
      return service.update(contextOf(request), keyOf(request), idOf(request), body);
    },
    async remove(request: FastifyRequest, reply: FastifyReply) {
      await service.remove(contextOf(request), keyOf(request), idOf(request));
      reply.code(204);
    },
  };
}

export type VersionsController = ReturnType<typeof createVersionsController>;
