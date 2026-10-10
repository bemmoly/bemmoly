import { ForbiddenError, UnauthenticatedError } from '@bemmoly/shared';
import type { FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import type { Actor } from '../contracts/authz.ts';
import type { SessionResolver } from '../contracts/session-resolver.ts';
import type { RealtimeHub, RealtimeMetricsHook } from '../services/realtime/index.ts';

const HEARTBEAT_MS = 30_000;
/** Hub messages are small JSON; the socket server's limit is larger because /collab shares it. */
export const REALTIME_MAX_MESSAGE_BYTES = 16 * 1024;

export interface RealtimeControllerDeps {
  hub: RealtimeHub;
  /** Absent until identity is wired: every upgrade is refused with 401. */
  sessions?: SessionResolver;
  /** The observability service's `getMetrics().realtime`. */
  metrics?: RealtimeMetricsHook;
}

export function createRealtimeController(deps: RealtimeControllerDeps) {
  const actors = new WeakMap<FastifyRequest, Actor>();
  return {
    /** Runs before the upgrade: cross-site or signed-out upgrades get no socket. */
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
      const client = deps.hub.connect(socket, actor);
      deps.metrics?.connectionOpened();
      let alive = true;
      const heartbeat = setInterval(() => {
        if (!alive) {
          socket.terminate();
          return;
        }
        alive = false;
        socket.ping();
      }, HEARTBEAT_MS);
      socket.on('pong', () => {
        alive = true;
      });
      socket.on('message', (data: Buffer) => {
        if (data.byteLength > REALTIME_MAX_MESSAGE_BYTES) {
          socket.close(1009, 'message too big');
          return;
        }
        client.receive(String(data)).catch((error: unknown) => {
          request.log.warn({ err: error }, 'realtime message handling failed');
        });
      });
      socket.on('close', () => {
        clearInterval(heartbeat);
        client.disconnect();
        deps.metrics?.connectionClosed();
      });
    },
  };
}

export type RealtimeController = ReturnType<typeof createRealtimeController>;
