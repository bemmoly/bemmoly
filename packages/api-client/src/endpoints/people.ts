import {
  apiTokenSchema,
  createApiTokenRequestSchema,
  createApiTokenResponseSchema,
  createInvitationsRequestSchema,
  createInvitationsResponseSchema,
  createTeamRequestSchema,
  listSchema,
  teamSchema,
  updateUserRequestSchema,
  userSchema,
  usersPageSchema,
  usersQuerySchema,
  type CreateApiTokenRequest,
  type CreateInvitationsRequest,
  type CreateTeamRequest,
  type UpdateUserRequest,
  type UsersQuery,
} from '@bemmoly/shared';
import type { Http } from '../http.ts';
import { enc, validated } from './validate.ts';

const teamsSchema = listSchema(teamSchema);
const apiTokensSchema = listSchema(apiTokenSchema);

export function peopleEndpoints(http: Http) {
  return {
    users: {
      list: async (query: UsersQuery = {}) =>
        http.request('/api/v1/users', usersPageSchema, {
          query: validated(usersQuerySchema, query),
        }),
      update: async (id: string, body: UpdateUserRequest) =>
        http.request(`/api/v1/users/${enc(id)}`, userSchema, {
          method: 'PATCH',
          body: validated(updateUserRequestSchema, body),
        }),
    },
    invitations: {
      create: async (body: CreateInvitationsRequest) =>
        http.request('/api/v1/invitations', createInvitationsResponseSchema, {
          method: 'POST',
          body: validated(createInvitationsRequestSchema, body),
          idempotent: true,
        }),
    },
    teams: {
      list: async () => http.request('/api/v1/teams', teamsSchema),
      create: async (body: CreateTeamRequest) =>
        http.request('/api/v1/teams', teamSchema, {
          method: 'POST',
          body: validated(createTeamRequestSchema, body),
          idempotent: true,
        }),
    },
    apiTokens: {
      list: async () => http.request('/api/v1/api-tokens', apiTokensSchema),
      create: async (body: CreateApiTokenRequest) =>
        http.request('/api/v1/api-tokens', createApiTokenResponseSchema, {
          method: 'POST',
          body: validated(createApiTokenRequestSchema, body),
          idempotent: true,
        }),
      revoke: async (id: string) =>
        http.send(`/api/v1/api-tokens/${enc(id)}`, { method: 'DELETE' }),
    },
  };
}
