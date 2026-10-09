import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { projectRefParamsSchema } from '../../../shared/boards.ts';
import {
  addProjectMembersBodySchema,
  projectMemberParamsSchema,
  updateProjectMemberBodySchema,
  type AddProjectMembersResponse,
  type ProjectMember,
  type ProjectMembersResponse,
} from '../../../shared/members.ts';
import type { ProjectMembersService } from '../services/projects/members.ts';

export function createMembersController(service: ProjectMembersService) {
  const member = (request: FastifyRequest) =>
    parseOrThrow(projectMemberParamsSchema, request.params);
  const project = (request: FastifyRequest) =>
    parseOrThrow(projectRefParamsSchema, request.params).key;

  return {
    async list(request: FastifyRequest): Promise<ProjectMembersResponse> {
      return service.list(contextOf(request), project(request));
    },
    async add(request: FastifyRequest, reply: FastifyReply): Promise<AddProjectMembersResponse> {
      const body = parseOrThrow(addProjectMembersBodySchema, request.body);
      const added = await service.add(contextOf(request), project(request), body);
      reply.code(201);
      return added;
    },
    async update(request: FastifyRequest): Promise<ProjectMember> {
      const { key, userId } = member(request);
      const body = parseOrThrow(updateProjectMemberBodySchema, request.body);
      return service.setRole(contextOf(request), key, userId, body.roleId);
    },
    async remove(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const { key, userId } = member(request);
      await service.remove(contextOf(request), key, userId);
      reply.code(204);
    },
  };
}

export type MembersController = ReturnType<typeof createMembersController>;
