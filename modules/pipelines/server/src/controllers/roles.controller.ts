import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  addGroupMembersBodySchema,
  createApprovalGroupBodySchema,
  approvalGroupMemberParamsSchema,
  approvalGroupParamsSchema,
  invitationParamsSchema,
  invitePeopleBodySchema,
  personParamsSchema,
  setPersonRoleBodySchema,
  updateApprovalGroupBodySchema,
} from '../../../shared/roles.ts';
import type { RolesService } from '../services/roles/index.ts';

/** The person's role, People and roles, and approval groups under /api/v1/pipelines. */
export function createRolesController(service: RolesService) {
  return {
    me(request: FastifyRequest) {
      return service.me(contextOf(request));
    },
    people(request: FastifyRequest) {
      return service.people(contextOf(request));
    },
    setRole(request: FastifyRequest) {
      const { userId } = parseOrThrow(personParamsSchema, request.params);
      const { role } = parseOrThrow(setPersonRoleBodySchema, request.body);
      return service.setRole(contextOf(request), userId, role);
    },
    async removePerson(request: FastifyRequest, reply: FastifyReply) {
      const { userId } = parseOrThrow(personParamsSchema, request.params);
      await service.removePerson(contextOf(request), userId);
      reply.code(204);
    },
    async invite(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(invitePeopleBodySchema, request.body);
      const result = await service.invite(contextOf(request), body);
      reply.code(201);
      return result;
    },
    async revokeInvitation(request: FastifyRequest, reply: FastifyReply) {
      const { id } = parseOrThrow(invitationParamsSchema, request.params);
      await service.revokeInvitation(contextOf(request), id);
      reply.code(204);
    },
    async groups(request: FastifyRequest) {
      return { items: await service.groups.list(contextOf(request)) };
    },
    async createGroup(request: FastifyRequest, reply: FastifyReply) {
      const body = parseOrThrow(createApprovalGroupBodySchema, request.body);
      const group = await service.groups.create(contextOf(request), body);
      reply.code(201);
      return group;
    },
    updateGroup(request: FastifyRequest) {
      const { id } = parseOrThrow(approvalGroupParamsSchema, request.params);
      const body = parseOrThrow(updateApprovalGroupBodySchema, request.body);
      return service.groups.update(contextOf(request), id, body);
    },
    async removeGroup(request: FastifyRequest, reply: FastifyReply) {
      const { id } = parseOrThrow(approvalGroupParamsSchema, request.params);
      await service.groups.remove(contextOf(request), id);
      reply.code(204);
    },
    async addMembers(request: FastifyRequest, reply: FastifyReply) {
      const { id } = parseOrThrow(approvalGroupParamsSchema, request.params);
      const body = parseOrThrow(addGroupMembersBodySchema, request.body);
      const group = await service.groups.addMembers(contextOf(request), id, body);
      reply.code(201);
      return group;
    },
    async removeMember(request: FastifyRequest, reply: FastifyReply) {
      const { id, userId } = parseOrThrow(approvalGroupMemberParamsSchema, request.params);
      await service.groups.removeMember(contextOf(request), id, userId);
      reply.code(204);
    },
  };
}

export type RolesController = ReturnType<typeof createRolesController>;
