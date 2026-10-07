import type { IncomingHttpHeaders } from 'node:http';
import type { Actor } from './authz.ts';

export interface ResolvedSession {
  /** Always a `user` actor: sessions belong to people, never to tokens. */
  actor: Actor;
  sessionId: string;
  expiresAt: Date;
}

/**
 * Authenticates a request that carries the session cookie, such as a WebSocket
 * upgrade on /ws or /collab. Returns null when the cookie is missing, unknown,
 * expired or belongs to a deactivated person; never throws for those cases.
 * Callers that accept upgrades must also check the Origin header.
 */
export interface SessionResolver {
  resolve(headers: IncomingHttpHeaders): Promise<ResolvedSession | null>;
  /** True when the Origin header is the workspace's own origin (same-origin upgrade). */
  isAllowedOrigin(headers: IncomingHttpHeaders): boolean;
}
