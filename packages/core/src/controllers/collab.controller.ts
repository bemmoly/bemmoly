import { ForbiddenError, UnauthenticatedError } from '@bemmoly/shared';
import type { FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import type { Actor } from '../contracts/authz.ts';
import type { SessionResolver } from '../contracts/session-resolver.ts';
import type { CollabHost } from '../services/collab/index.ts';

export interface CollabControllerDeps {
  host: CollabHost;
  /** Absent until identity is wired: every upgrade is refused with 401. */
  sessions?: SessionResolver;
}

/** /collab: the same session cookie and origin rules as /ws, then the host takes the socket. */
export function createCollabController(deps: CollabControllerDeps) {
  const actors = new WeakMap<FastifyRequest, Actor>();
  return {
    async authenticate(request: FastifyRequest): Promise<void> {
      if (!deps.sessions) throw new UnauthenticatedError();
      if (!deps.sessions.isAllowedOrigin(request.headers)) {
        throw new ForbiddenError('WebSocket upgrades must come from the workspace origin');
      }
      const session = await deps.sessions.resolve(request.headers);
      if (!session) throw new UnauthenticatedError();
      actors.set(request, session.actor);
    },
    connect(socket: WebSocket, request: FastifyRequest): void {
      const actor = actors.get(request);
      if (!actor) {
        socket.close(1008, 'unauthenticated');
        return;
      }
      deps.host.accept(socket, { url: request.url, headers: request.headers }, actor);
    },
  };
}

export type CollabController = ReturnType<typeof createCollabController>;
