import {
  realtimeClientMessageSchema,
  type RealtimeScope,
  type RealtimeServerMessage,
} from '@bemmoly/shared';
import type { Logger } from '../../config/logger.ts';
import type { Actor } from '../../contracts/authz.ts';
import type { ModuleAccessResolver } from '../../contracts/module-access.ts';
import type { RealtimeMessage } from '../../contracts/realtime.ts';
import type { RealtimeMetrics } from '../../contracts/telemetry.ts';

/** The part of a WebSocket the hub needs; `ws` sockets satisfy it. */
export interface HubSocket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

/** The observability service's `getMetrics().realtime`, which the host passes. */
export type RealtimeMetricsHook = RealtimeMetrics;

/** Decides whether an actor may subscribe to a scope. */
export type SubscriptionAuthorizer = (actor: Actor, scope: RealtimeScope) => Promise<boolean>;

export interface RealtimeHubOptions {
  logger: Logger;
  /** Module scopes are checked against module access when present. */
  moduleAccess?: ModuleAccessResolver;
  /** Project and space membership checks; the identity service supplies one. */
  authorizeSubscription?: SubscriptionAuthorizer;
}

export interface HubClient {
  receive(raw: string): Promise<void>;
  disconnect(): void;
}

export interface RealtimeHub {
  connect(socket: HubSocket, actor: Actor): HubClient;
  /** Forwards one message to every subscriber whose scope matches; returns how many. */
  dispatch(message: RealtimeMessage): number;
  connections(): number;
  closeAll(): void;
}

interface Connection {
  socket: HubSocket;
  actor: Actor;
  scopes: Set<string>;
}

export function scopeKey(scope: RealtimeScope): string {
  return scope.kind === 'workspace' ? 'workspace' : `${scope.kind}:${scope.id}`;
}

/** The scopes a message reaches: its project, space or module, or the workspace. */
export function messageScopes(message: RealtimeMessage): string[] {
  const keys: string[] = [];
  if (message.projectId) keys.push(`project:${message.projectId}`);
  if (message.spaceId) keys.push(`space:${message.spaceId}`);
  if (message.moduleId) keys.push(`module:${message.moduleId}`);
  return keys.length > 0 ? keys : ['workspace'];
}

/** The person behind a connection: the user, or the user a token acts for. */
export function personOf(actor: Actor): string | undefined {
  return actor.kind === 'user' ? actor.id : actor.userId;
}

/**
 * A message addressed to a user (their inbox) reaches every socket of that
 * user and nobody else, subscribed or not; any other message reaches the
 * sockets subscribed to one of its scopes.
 */
function reaches(connection: Connection, message: RealtimeMessage, keys: string[]): boolean {
  if (message.userId) return personOf(connection.actor) === message.userId;
  return keys.some((key) => connection.scopes.has(key));
}

function send(socket: HubSocket, message: RealtimeServerMessage): void {
  socket.send(JSON.stringify(message));
}

export function createRealtimeHub(options: RealtimeHubOptions): RealtimeHub {
  const connections = new Set<Connection>();

  async function maySubscribe(actor: Actor, scope: RealtimeScope): Promise<boolean> {
    if (scope.kind === 'module' && options.moduleAccess) {
      if (!(await options.moduleAccess.canAccess(actor, scope.id))) return false;
    }
    return options.authorizeSubscription ? options.authorizeSubscription(actor, scope) : true;
  }

  async function handle(connection: Connection, raw: string): Promise<void> {
    let parsed;
    try {
      parsed = realtimeClientMessageSchema.safeParse(JSON.parse(raw));
    } catch {
      parsed = undefined;
    }
    if (!parsed?.success) {
      send(connection.socket, { type: 'error', code: 'bad_request', message: 'Unknown message' });
      return;
    }
    const message = parsed.data;
    if (message.type === 'ping') return send(connection.socket, { type: 'pong' });
    if (message.type === 'unsubscribe') {
      connection.scopes.delete(scopeKey(message.scope));
      return send(connection.socket, { type: 'unsubscribed', scope: message.scope });
    }
    if (!(await maySubscribe(connection.actor, message.scope))) {
      const code = message.scope.kind === 'module' ? 'module_access_denied' : 'forbidden';
      return send(connection.socket, { type: 'error', code, message: 'Not allowed to subscribe' });
    }
    connection.scopes.add(scopeKey(message.scope));
    send(connection.socket, { type: 'subscribed', scope: message.scope });
  }

  return {
    connect(socket, actor) {
      const connection: Connection = { socket, actor, scopes: new Set() };
      connections.add(connection);
      send(socket, { type: 'ready' });
      return {
        receive: (raw) => handle(connection, raw),
        disconnect: () => void connections.delete(connection),
      };
    },
    dispatch(message) {
      const keys = messageScopes(message);
      const payload = JSON.stringify({ type: 'invalidate', message });
      let delivered = 0;
      for (const connection of connections) {
        if (!reaches(connection, message, keys)) continue;
        try {
          connection.socket.send(payload);
          delivered += 1;
        } catch (error) {
          options.logger.warn({ err: error }, 'dropping a realtime client that failed a send');
          connections.delete(connection);
        }
      }
      return delivered;
    },
    connections: () => connections.size,
    closeAll() {
      for (const connection of connections) connection.socket.close(1001, 'server shutting down');
      connections.clear();
    },
  };
}
