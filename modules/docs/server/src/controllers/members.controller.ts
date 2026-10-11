import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  addSpaceMembersBodySchema,
  putSpaceMemberBodySchema,
  spaceMemberParamsSchema,
  type AddSpaceMembersResponse,
  type SpaceMember,
  type SpaceMembersResponse,
} from '../../../shared/members.ts';
import type { SpaceMembersService } from '../services/spaces/members.ts';
import { spaceRefOf } from './spaces.controller.ts';

export function createMembersController(service: SpaceMembersService) {
  const member = (request: FastifyRequest) => parseOrThrow(spaceMemberParamsSchema, request.params);

  return {
    async list(request: FastifyRequest): Promise<SpaceMembersResponse> {
      return service.list(contextOf(request), spaceRefOf(request));
    },
    async add(request: FastifyRequest, reply: FastifyReply): Promise<AddSpaceMembersResponse> {
      const body = parseOrThrow(addSpaceMembersBodySchema, request.body);
      const added = await service.add(contextOf(request), spaceRefOf(request), body);
      reply.code(201);
      return added;
    },
    async put(request: FastifyRequest): Promise<SpaceMember> {
      const { spaceKey, userId } = member(request);
      const body = parseOrThrow(putSpaceMemberBodySchema, request.body);
      return service.put(contextOf(request), spaceKey, userId, body.roleId);
    },
    async remove(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const { spaceKey, userId } = member(request);
      await service.remove(contextOf(request), spaceKey, userId);
      reply.code(204);
    },
  };
}

export type MembersController = ReturnType<typeof createMembersController>;
