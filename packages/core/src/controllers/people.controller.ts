import {
  createInvitationsSchema,
  createTeamSchema,
  idParamsSchema,
  listUsersQuerySchema,
  parseOrThrow,
  teamMemberParamsSchema,
  updateTeamSchema,
  updateUserSchema,
  type InvitationsResponse,
  type Team,
  type TeamMember,
  type TeamMembersResponse,
  type TeamsResponse,
  type User,
  type UsersPage,
} from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  addTeamMember,
  createInvitations,
  createTeam,
  deactivateUser,
  deleteTeam,
  getTeam,
  getUser,
  listInvitations,
  listTeamMembers,
  listTeams,
  listUsers,
  reactivateUser,
  removeTeamMember,
  revokeInvitation,
  updateTeam,
  updateUser,
  type IdentityDependencies,
} from '../services/identity/index.ts';
import { contextOf } from './request-context.ts';

/** Users, invitations and teams: the People screen. */
export function createPeopleController(deps: IdentityDependencies) {
  const { db } = deps;
  const idOf = (request: FastifyRequest) => parseOrThrow(idParamsSchema, request.params).id;
  return {
    async listUsers(request: FastifyRequest): Promise<UsersPage> {
      contextOf(request);
      return listUsers(db, parseOrThrow(listUsersQuerySchema, request.query));
    },

    async getUser(request: FastifyRequest): Promise<User> {
      contextOf(request);
      return getUser(db, idOf(request));
    },

    async updateUser(request: FastifyRequest): Promise<User> {
      const input = parseOrThrow(updateUserSchema, request.body);
      return updateUser(db, contextOf(request), idOf(request), input);
    },

    async deactivateUser(request: FastifyRequest): Promise<User> {
      return deactivateUser(db, contextOf(request), idOf(request));
    },

    async reactivateUser(request: FastifyRequest): Promise<User> {
      return reactivateUser(db, contextOf(request), idOf(request));
    },

    async listInvitations(request: FastifyRequest): Promise<InvitationsResponse> {
      return { items: await listInvitations(db, contextOf(request)) };
    },

    async createInvitations(
      request: FastifyRequest,
      reply: FastifyReply,
    ): Promise<InvitationsResponse> {
      const input = parseOrThrow(createInvitationsSchema, request.body);
      const items = await createInvitations(deps, contextOf(request), input);
      reply.code(201);
      return { items };
    },

    async revokeInvitation(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      await revokeInvitation(db, contextOf(request), idOf(request));
      reply.code(204).send();
    },

    async listTeams(request: FastifyRequest): Promise<TeamsResponse> {
      contextOf(request);
      return { items: await listTeams(db) };
    },

    async getTeam(request: FastifyRequest): Promise<Team> {
      contextOf(request);
      return getTeam(db, idOf(request));
    },

    async createTeam(request: FastifyRequest, reply: FastifyReply): Promise<Team> {
      const input = parseOrThrow(createTeamSchema, request.body);
      const team = await createTeam(db, contextOf(request), input);
      reply.code(201);
      return team;
    },

    async updateTeam(request: FastifyRequest): Promise<Team> {
      const input = parseOrThrow(updateTeamSchema, request.body);
      return updateTeam(db, contextOf(request), idOf(request), input);
    },

    async deleteTeam(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      await deleteTeam(db, contextOf(request), idOf(request));
      reply.code(204).send();
    },

    async listTeamMembers(request: FastifyRequest): Promise<TeamMembersResponse> {
      contextOf(request);
      return { items: await listTeamMembers(db, idOf(request)) };
    },

    async addTeamMember(request: FastifyRequest): Promise<TeamMember> {
      const { id, userId } = parseOrThrow(teamMemberParamsSchema, request.params);
      return addTeamMember(db, contextOf(request), id, userId);
    },

    async removeTeamMember(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const { id, userId } = parseOrThrow(teamMemberParamsSchema, request.params);
      await removeTeamMember(db, contextOf(request), id, userId);
      reply.code(204).send();
    },
  };
}

export type PeopleController = ReturnType<typeof createPeopleController>;
