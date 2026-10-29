import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { userIdParamsSchema } from '../../../shared/common.ts';
import {
  createProfileFieldBodySchema,
  directoryQuerySchema,
  updateProfileFieldsBodySchema,
} from '../../../shared/profiles.ts';
import type { DirectoryService } from '../services/directory/index.ts';

const userIdOf = (request: FastifyRequest) =>
  parseOrThrow(userIdParamsSchema, request.params).userId;

export function createDirectoryController(service: DirectoryService) {
  return {
    async list(request: FastifyRequest) {
      const query = parseOrThrow(directoryQuerySchema, request.query);
      return { items: await service.list(contextOf(request), query) };
    },
    async profile(request: FastifyRequest) {
      return service.profile(contextOf(request), userIdOf(request));
    },
    async updateFields(request: FastifyRequest) {
      const body = parseOrThrow(updateProfileFieldsBodySchema, request.body);
      return service.updateFields(contextOf(request), userIdOf(request), body.values);
    },
    async fieldDefinitions(request: FastifyRequest) {
      return { items: await service.fieldDefinitions(contextOf(request)) };
    },
    async createField(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(createProfileFieldBodySchema, request.body);
      reply.code(201);
      return service.createField(contextOf(request), body);
    },
  };
}

export type DirectoryController = ReturnType<typeof createDirectoryController>;
