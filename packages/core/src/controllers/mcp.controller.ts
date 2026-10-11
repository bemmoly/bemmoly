import { moduleIdSchema, UnauthenticatedError } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { McpService } from '../services/mcp/index.ts';

const paramsSchema = z.object({ moduleId: moduleIdSchema.optional() });
const querySchema = z.object({ modules: z.string().max(500).optional() });

type Token = Awaited<ReturnType<McpService['authenticate']>>;

/**
 * /mcp sits outside the API prefix, so it reads its own Bearer token (a personal access token
 * or an OAuth access token): in onRequest, before the rate limiter keys the request by person.
 * A refused token counts toward the per-IP budget for refused credentials, like a refused API
 * token, and the 401 names the protected resource metadata so a client can sign in.
 */
export function createMcpController(service: McpService) {
  const tokens = new WeakMap<FastifyRequest, Token>();
  return {
    async authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      if (request.method !== 'POST') return;
      const moduleId = paramsSchema.safeParse(request.params).data?.moduleId;
      try {
        const token = await service.authenticate(request.headers.authorization, moduleId);
        tokens.set(request, token);
        request.actor = token.actor;
        request.tokenScopes = token.scopes;
        request.tokenModules = token.modules;
      } catch (error) {
        if (error instanceof UnauthenticatedError) {
          const presented = Boolean(request.headers.authorization);
          if (presented) request.credentialRejected = true;
          reply.header(
            'www-authenticate',
            service.challenge(moduleId, presented ? 'invalid_token' : undefined),
          );
        }
        throw error;
      }
    },

    async handle(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const token = tokens.get(request);
      if (!token) throw new UnauthenticatedError();
      const params = paramsSchema.parse(request.params);
      const query = querySchema.parse(request.query);
      const prepared = await service.prepare({
        token,
        ...(params.moduleId ? { moduleId: params.moduleId } : {}),
        ...(query.modules ? { modulesQuery: query.modules } : {}),
        ip: request.ip,
        requestId: request.id,
      });
      // From here the MCP transport writes the response itself.
      reply.hijack();
      await prepared.serve({ request: request.raw, response: reply.raw, body: request.body });
    },

    /** Stateless: no server-sent stream to open and no session to end. */
    methodNotAllowed(reply: FastifyReply) {
      reply.code(405).header('allow', 'POST');
      return {
        jsonrpc: '2.0',
        error: { code: -32000, message: 'This server answers POST only (stateless)' },
        id: null,
      };
    },
  };
}

export type McpController = ReturnType<typeof createMcpController>;
