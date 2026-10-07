import type { Actor } from './authz.ts';

/** The parts of an HTTP request (or WebSocket upgrade) a session is read from. */
export interface SessionRequest {
  headers: Readonly<Record<string, string | string[] | undefined>>;
  ip?: string;
}

/**
 * Turns a request into the acting user or token, from the session cookie or a
 * bearer token. Implemented by the identity service; the kernel's admin routes
 * and the WebSocket hub call it on every request and on upgrade.
 */
export interface SessionResolver {
  /** The actor, or null when the request carries no valid session or token. */
  resolve(request: SessionRequest): Promise<Actor | null>;
}
