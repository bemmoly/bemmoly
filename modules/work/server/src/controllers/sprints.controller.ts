import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { projectRefParamsSchema } from '../../../shared/boards.ts';
import {
  completeSprintBodySchema,
  createSprintBodySchema,
  listSprintsQuerySchema,
  startSprintBodySchema,
  updateSprintBodySchema,
  type Sprint,
} from '../../../shared/sprints.ts';
import type { SprintsService } from '../services/sprints/index.ts';

const idParams = z.object({ id: z.uuid() });

export function createSprintsController(service: SprintsService) {
  const id = (request: FastifyRequest) => parseOrThrow(idParams, request.params).id;
  const project = (request: FastifyRequest) =>
    parseOrThrow(projectRefParamsSchema, request.params).key;

  return {
    async list(request: FastifyRequest): Promise<{ items: Sprint[] }> {
      const query = parseOrThrow(listSprintsQuerySchema, request.query);
      return { items: await service.list(contextOf(request), project(request), query) };
    },
    async create(request: FastifyRequest, reply: FastifyReply): Promise<Sprint> {
      const body = parseOrThrow(createSprintBodySchema, request.body);
      reply.code(201);
      return service.create(contextOf(request), project(request), body);
    },
    async get(request: FastifyRequest): Promise<Sprint> {
      return service.get(contextOf(request), id(request));
    },
    async update(request: FastifyRequest): Promise<Sprint> {
      const body = parseOrThrow(updateSprintBodySchema, request.body);
      return service.update(contextOf(request), id(request), body);
    },
    async remove(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      await service.remove(contextOf(request), id(request));
      reply.code(204).send();
    },
    async start(request: FastifyRequest): Promise<Sprint> {
      const body = parseOrThrow(startSprintBodySchema, request.body ?? {});
      return service.start(contextOf(request), id(request), body);
    },
    async complete(request: FastifyRequest): Promise<Sprint> {
      const body = parseOrThrow(completeSprintBodySchema, request.body ?? {});
      return service.complete(contextOf(request), id(request), body);
    },
  };
}

export type SprintsController = ReturnType<typeof createSprintsController>;
