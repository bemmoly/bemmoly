import {
  parseOrThrow,
  scimGroupInputSchema,
  scimIdParamsSchema,
  scimListQuerySchema,
  scimPatchSchema,
  scimUserInputSchema,
  UnauthenticatedError,
} from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Database } from '../clients/drizzle.ts';
import {
  authenticateScimToken,
  createScimGroup,
  createScimUser,
  deleteScimGroup,
  deleteScimUser,
  getScimGroup,
  getScimUser,
  listScimGroups,
  listScimUsers,
  patchScimGroup,
  patchScimUser,
  replaceScimGroup,
  replaceScimUser,
  type ScimContext,
} from '../services/scim/index.ts';
import { scimBaseUrl } from '../services/sso/index.ts';
import { metaOf } from './request-context.ts';

export const SCIM_CONTENT_TYPE = 'application/scim+json';
const BEARER = /^Bearer\s+(\S+)$/i;

export interface ScimControllerDependencies {
  db: Database;
  publicUrl: string;
  now?: () => Date;
}

/** SCIM 2.0 for identity providers: Users and Groups, authenticated by a SCIM bearer token. */
export function createScimController(deps: ScimControllerDependencies) {
  const baseUrl = scimBaseUrl(deps.publicUrl);

  async function contextOf(request: FastifyRequest, reply: FastifyReply): Promise<ScimContext> {
    const token = BEARER.exec(request.headers.authorization ?? '')?.[1];
    const actor = token
      ? await authenticateScimToken(deps.db, token, deps.now?.() ?? new Date())
      : null;
    if (!actor) {
      // Counted by the rate limiter's refused-credentials budget for this address.
      request.credentialRejected = true;
      throw new UnauthenticatedError('Send a SCIM token as "Authorization: Bearer <token>"');
    }
    reply.type(SCIM_CONTENT_TYPE);
    return { db: deps.db, baseUrl, actor, meta: metaOf(request) };
  }

  const idOf = (request: FastifyRequest) => parseOrThrow(scimIdParamsSchema, request.params).id;

  return {
    async listUsers(request: FastifyRequest, reply: FastifyReply) {
      const ctx = await contextOf(request, reply);
      return listScimUsers(ctx, parseOrThrow(scimListQuerySchema, request.query ?? {}));
    },
    async getUser(request: FastifyRequest, reply: FastifyReply) {
      return getScimUser(await contextOf(request, reply), idOf(request));
    },
    async createUser(request: FastifyRequest, reply: FastifyReply) {
      const ctx = await contextOf(request, reply);
      const created = await createScimUser(ctx, parseOrThrow(scimUserInputSchema, request.body));
      reply.code(201).header('location', created.meta.location);
      return created;
    },
    async replaceUser(request: FastifyRequest, reply: FastifyReply) {
      const ctx = await contextOf(request, reply);
      return replaceScimUser(ctx, idOf(request), parseOrThrow(scimUserInputSchema, request.body));
    },
    async patchUser(request: FastifyRequest, reply: FastifyReply) {
      const ctx = await contextOf(request, reply);
      return patchScimUser(ctx, idOf(request), parseOrThrow(scimPatchSchema, request.body));
    },
    async deleteUser(request: FastifyRequest, reply: FastifyReply) {
      await deleteScimUser(await contextOf(request, reply), idOf(request));
      reply.code(204).send();
    },

    async listGroups(request: FastifyRequest, reply: FastifyReply) {
      const ctx = await contextOf(request, reply);
      return listScimGroups(ctx, parseOrThrow(scimListQuerySchema, request.query ?? {}));
    },
    async getGroup(request: FastifyRequest, reply: FastifyReply) {
      return getScimGroup(await contextOf(request, reply), idOf(request));
    },
    async createGroup(request: FastifyRequest, reply: FastifyReply) {
      const ctx = await contextOf(request, reply);
      const created = await createScimGroup(ctx, parseOrThrow(scimGroupInputSchema, request.body));
      reply.code(201).header('location', created.meta.location);
      return created;
    },
    async replaceGroup(request: FastifyRequest, reply: FastifyReply) {
      const ctx = await contextOf(request, reply);
      return replaceScimGroup(ctx, idOf(request), parseOrThrow(scimGroupInputSchema, request.body));
    },
    async patchGroup(request: FastifyRequest, reply: FastifyReply) {
      const ctx = await contextOf(request, reply);
      return patchScimGroup(ctx, idOf(request), parseOrThrow(scimPatchSchema, request.body));
    },
    async deleteGroup(request: FastifyRequest, reply: FastifyReply) {
      await deleteScimGroup(await contextOf(request, reply), idOf(request));
      reply.code(204).send();
    },
  };
}

export type ScimController = ReturnType<typeof createScimController>;
