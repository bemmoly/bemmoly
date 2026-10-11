import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  createComponentBodySchema,
  listComponentsQuerySchema,
  updateComponentBodySchema,
} from '../../../shared/versions-components.ts';
import type { ComponentsService } from '../services/components/index.ts';
import { keyOf } from './projects.controller.ts';
import { idOf } from './types.controller.ts';

/** A project's components, at /projects/:key/components; the list answers the pickers too. */
export function createComponentsController(service: ComponentsService) {
  return {
    async list(request: FastifyRequest) {
      const query = parseOrThrow(listComponentsQuerySchema, request.query);
      return service.list(contextOf(request), keyOf(request), query);
    },
    async create(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(createComponentBodySchema, request.body);
      reply.code(201);
      return service.create(contextOf(request), keyOf(request), body);
    },
    async update(request: FastifyRequest) {
      const body = parseOrThrow(updateComponentBodySchema, request.body);
      return service.update(contextOf(request), keyOf(request), idOf(request), body);
    },
    async remove(request: FastifyRequest, reply: FastifyReply) {
      await service.remove(contextOf(request), keyOf(request), idOf(request));
      reply.code(204);
    },
  };
}

export type ComponentsController = ReturnType<typeof createComponentsController>;
