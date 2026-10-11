import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { McpController } from '../controllers/mcp.controller.ts';

export interface McpRateLimit {
  max: number;
  windowMs: number;
}

/** Every call a client makes, per person; reads are cheap, but a loop in a client is not. */
export const DEFAULT_MCP_RATE_LIMIT: McpRateLimit = { max: 120, windowMs: 60_000 };

/**
 * The built-in MCP server (Streamable HTTP): `/mcp` reaches every exposed module and
 * `/mcp/:moduleId` one of them. Authenticated by personal access token in the controller.
 */
export function mcpRoutes(
  controller: McpController,
  limit: McpRateLimit = DEFAULT_MCP_RATE_LIMIT,
): FastifyPluginAsync {
  return async (app) => {
    const config = {
      rateLimit: {
        max: limit.max,
        timeWindow: limit.windowMs,
        keyGenerator: (request: FastifyRequest) =>
          `mcp|${request.actor?.userId ?? request.actor?.id ?? `ip:${request.ip}`}`,
      },
    };
    const onRequest = controller.authenticate;
    for (const url of ['/mcp', '/mcp/:moduleId']) {
      app.post(url, { config, onRequest }, async (request, reply) =>
        controller.handle(request, reply),
      );
      app.get(url, { config }, async (_request, reply) => controller.methodNotAllowed(reply));
      app.delete(url, { config }, async (_request, reply) => controller.methodNotAllowed(reply));
    }
  };
}
