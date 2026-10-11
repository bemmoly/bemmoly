import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  createLabelBodySchema,
  listLabelsQuerySchema,
  updateLabelBodySchema,
} from '../../../shared/links-labels.ts';
import type { LabelsService } from '../services/labels/index.ts';
import { keyOf } from './projects.controller.ts';
import { idOf } from './types.controller.ts';

/** A project's labels, at /projects/:key/labels; the list answers the pickers too. */
export function createLabelsController(service: LabelsService) {
  return {
    async list(request: FastifyRequest) {
      const query = parseOrThrow(listLabelsQuerySchema, request.query);
      return service.list(contextOf(request), keyOf(request), query);
    },
    async create(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(createLabelBodySchema, request.body);
      reply.code(201);
      return service.create(contextOf(request), keyOf(request), body);
    },
    async update(request: FastifyRequest) {
      const body = parseOrThrow(updateLabelBodySchema, request.body);
      return service.update(contextOf(request), keyOf(request), idOf(request), body);
    },
    async remove(request: FastifyRequest, reply: FastifyReply) {
      await service.remove(contextOf(request), keyOf(request), idOf(request));
      reply.code(204);
    },
  };
}

export type LabelsController = ReturnType<typeof createLabelsController>;
