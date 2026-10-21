import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  createInitiativeBodySchema,
  linkInitiativeEpicBodySchema,
  listInitiativesQuerySchema,
  updateInitiativeBodySchema,
} from '../../../shared/initiatives.ts';
import type { InitiativesService } from '../services/initiatives/index.ts';
import { idOf } from './types.controller.ts';

const epicParamsSchema = z.object({ epicId: z.uuid() });

/** Initiatives at /initiatives, and the epics they gather at /initiatives/:id/epics. */
export function createInitiativesController(service: InitiativesService) {
  return {
    async list(request: FastifyRequest) {
      const query = parseOrThrow(listInitiativesQuerySchema, request.query);
      return service.list(contextOf(request), query);
    },
    async get(request: FastifyRequest) {
      return service.get(contextOf(request), idOf(request));
    },
    async create(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(createInitiativeBodySchema, request.body);
      reply.code(201);
      return service.create(contextOf(request), body);
    },
    async update(request: FastifyRequest) {
      const body = parseOrThrow(updateInitiativeBodySchema, request.body);
      return service.update(contextOf(request), idOf(request), body);
    },
    async archive(request: FastifyRequest) {
      return service.archive(contextOf(request), idOf(request));
    },
    async unarchive(request: FastifyRequest) {
      return service.unarchive(contextOf(request), idOf(request));
    },
    async linkEpic(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(linkInitiativeEpicBodySchema, request.body);
      reply.code(201);
      return service.linkEpic(contextOf(request), idOf(request), body);
    },
    async unlinkEpic(request: FastifyRequest, reply: FastifyReply) {
      const { epicId } = parseOrThrow(epicParamsSchema, request.params);
      await service.unlinkEpic(contextOf(request), idOf(request), epicId);
      reply.code(204);
    },
  };
}

export type InitiativesController = ReturnType<typeof createInitiativesController>;
