import {
  acceptInvitationSchema,
  createApiTokenSchema,
  createFirstAdminSchema,
  idParamsSchema,
  invitationTokenParamsSchema,
  loginRequestSchema,
  logoutRequestSchema,
  parseOrThrow,
  passwordResetCompleteSchema,
  passwordResetRequestSchema,
  type ApiTokensResponse,
  type AuthUserResponse,
  type CreatedApiToken,
  type InvitationPreview,
  type MeResponse,
  type SessionsResponse,
  type SetupStatusResponse,
} from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  acceptInvitation,
  completePasswordReset,
  createApiToken,
  createFirstAdmin,
  getMe,
  getSetupStatus,
  listApiTokens,
  listMySessions,
  login,
  logout,
  previewInvitation,
  requestPasswordReset,
  revokeApiToken,
  revokeMySession,
  type IdentityDependencies,
} from '../services/identity/index.ts';
import { clearSession, clientOf, contextOf, setSessionCookie } from './request-context.ts';

/** Setup, sign-in and the signed-in person's own account. */
export function createIdentityController(deps: IdentityDependencies) {
  const { db, publicUrl } = deps;
  return {
    async setupStatus(): Promise<SetupStatusResponse> {
      return getSetupStatus(db);
    },

    async createFirstAdmin(
      request: FastifyRequest,
      reply: FastifyReply,
    ): Promise<AuthUserResponse> {
      const input = parseOrThrow(createFirstAdminSchema, request.body);
      const { user, session } = await createFirstAdmin(deps, input, clientOf(request));
      setSessionCookie(reply, publicUrl, session);
      reply.code(201);
      return { user };
    },

    async login(request: FastifyRequest, reply: FastifyReply): Promise<AuthUserResponse> {
      const input = parseOrThrow(loginRequestSchema, request.body);
      const client = { ...clientOf(request), previousSessionId: request.sessionId ?? undefined };
      const { user, session } = await login(deps, input, client);
      setSessionCookie(reply, publicUrl, session);
      return { user };
    },

    async logout(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const { everywhere } = parseOrThrow(logoutRequestSchema, request.body ?? {});
      await logout(db, contextOf(request), everywhere);
      clearSession(reply, publicUrl);
      reply.code(204).send();
    },

    async requestPasswordReset(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const input = parseOrThrow(passwordResetRequestSchema, request.body);
      await requestPasswordReset(deps, input, clientOf(request));
      reply.code(202).send();
    },

    async completePasswordReset(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const input = parseOrThrow(passwordResetCompleteSchema, request.body);
      await completePasswordReset(deps, input, clientOf(request));
      clearSession(reply, publicUrl);
      reply.code(204).send();
    },

    async previewInvitation(request: FastifyRequest): Promise<InvitationPreview> {
      const { token } = parseOrThrow(invitationTokenParamsSchema, request.params);
      return previewInvitation(deps, token);
    },

    async acceptInvitation(
      request: FastifyRequest,
      reply: FastifyReply,
    ): Promise<AuthUserResponse> {
      const { token } = parseOrThrow(invitationTokenParamsSchema, request.params);
      const input = parseOrThrow(acceptInvitationSchema, request.body);
      const { user, session } = await acceptInvitation(deps, token, input, clientOf(request));
      setSessionCookie(reply, publicUrl, session);
      reply.code(201);
      return { user };
    },

    async me(request: FastifyRequest): Promise<MeResponse> {
      return getMe(db, contextOf(request));
    },

    async listSessions(request: FastifyRequest): Promise<SessionsResponse> {
      return { items: await listMySessions(db, contextOf(request)) };
    },

    async revokeSession(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const { id } = parseOrThrow(idParamsSchema, request.params);
      const ctx = contextOf(request);
      await revokeMySession(db, ctx, id);
      if (id === ctx.sessionId) clearSession(reply, publicUrl);
      reply.code(204).send();
    },

    async listApiTokens(request: FastifyRequest): Promise<ApiTokensResponse> {
      return { items: await listApiTokens(db, contextOf(request)) };
    },

    async createApiToken(request: FastifyRequest, reply: FastifyReply): Promise<CreatedApiToken> {
      const input = parseOrThrow(createApiTokenSchema, request.body);
      const created = await createApiToken(db, contextOf(request), input);
      reply.code(201).header('cache-control', 'no-store');
      return created;
    },

    async revokeApiToken(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const { id } = parseOrThrow(idParamsSchema, request.params);
      await revokeApiToken(db, contextOf(request), id);
      reply.code(204).send();
    },
  };
}

export type IdentityController = ReturnType<typeof createIdentityController>;
