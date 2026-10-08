import {
  apiTokensResponseSchema,
  createApiTokenSchema,
  createdApiTokenSchema,
  createInvitationsResponseSchema,
  createInvitationsSchema,
  createTeamSchema,
  invitationsResponseSchema,
  issuedInvitationSchema,
  listUsersQuerySchema,
  teamMembersResponseSchema,
  teamSchema,
  teamsResponseSchema,
  updateTeamSchema,
  updateUserSchema,
  userSchema,
  usersPageSchema,
  type CreateApiTokenInput,
  type CreateInvitationsInput,
  type CreateTeamInput,
  type UpdateTeamInput,
  type UpdateUserInput,
  type UserStatus,
} from '@bemmoly/shared';
import type { Http } from '../http.ts';
import { enc, validated } from './validate.ts';

export interface UsersFilter {
  cursor?: string;
  limit?: number;
  status?: UserStatus;
  q?: string;
}

export function peopleEndpoints(http: Http) {
  return {
    users: {
      list: async (filter: UsersFilter = {}) =>
        http.request('/api/v1/users', usersPageSchema, {
          query: validated(listUsersQuerySchema, filter),
        }),
      get: async (id: string) => http.request(`/api/v1/users/${enc(id)}`, userSchema),
      update: async (id: string, body: UpdateUserInput) =>
        http.request(`/api/v1/users/${enc(id)}`, userSchema, {
          method: 'PATCH',
          body: validated(updateUserSchema, body),
        }),
      deactivate: async (id: string) =>
        http.request(`/api/v1/users/${enc(id)}/deactivate`, userSchema, { method: 'POST' }),
      reactivate: async (id: string) =>
        http.request(`/api/v1/users/${enc(id)}/reactivate`, userSchema, { method: 'POST' }),
    },
    invitations: {
      list: async () => http.request('/api/v1/invitations', invitationsResponseSchema),
      /**
       * Each item carries its accept link for the admin to share. Not marked idempotent: a
       * stored replay would keep the one-time links at rest, and a repeat only re-issues them.
       */
      create: async (body: CreateInvitationsInput) =>
        http.request('/api/v1/invitations', createInvitationsResponseSchema, {
          method: 'POST',
          body: validated(createInvitationsSchema, body),
        }),
      /** A fresh accept link for a pending invitation; the previous link stops working. */
      issueLink: async (id: string) =>
        http.request(`/api/v1/invitations/${enc(id)}/links`, issuedInvitationSchema, {
          method: 'POST',
        }),
      revoke: async (id: string) =>
        http.send(`/api/v1/invitations/${enc(id)}`, { method: 'DELETE' }),
    },
    teams: {
      list: async () => http.request('/api/v1/teams', teamsResponseSchema),
      create: async (body: CreateTeamInput) =>
        http.request('/api/v1/teams', teamSchema, {
          method: 'POST',
          body: validated(createTeamSchema, body),
          idempotent: true,
        }),
      update: async (id: string, body: UpdateTeamInput) =>
        http.request(`/api/v1/teams/${enc(id)}`, teamSchema, {
          method: 'PATCH',
          body: validated(updateTeamSchema, body),
        }),
      remove: async (id: string) => http.send(`/api/v1/teams/${enc(id)}`, { method: 'DELETE' }),
      members: async (id: string) =>
        http.request(`/api/v1/teams/${enc(id)}/members`, teamMembersResponseSchema),
      addMember: async (id: string, userId: string) =>
        http.send(`/api/v1/teams/${enc(id)}/members/${enc(userId)}`, { method: 'PUT' }),
      removeMember: async (id: string, userId: string) =>
        http.send(`/api/v1/teams/${enc(id)}/members/${enc(userId)}`, { method: 'DELETE' }),
    },
    apiTokens: {
      list: async () => http.request('/api/v1/api-tokens', apiTokensResponseSchema),
      /** The secret is in this response only. */
      create: async (body: CreateApiTokenInput) =>
        http.request('/api/v1/api-tokens', createdApiTokenSchema, {
          method: 'POST',
          body: validated(createApiTokenSchema, body),
        }),
      revoke: async (id: string) =>
        http.send(`/api/v1/api-tokens/${enc(id)}`, { method: 'DELETE' }),
    },
  };
}
