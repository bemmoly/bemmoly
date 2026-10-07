import { UnauthenticatedError } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { RequestContext } from '../services/authz/index.ts';
import type { IssuedSession } from '../services/identity/index.ts';
import {
  clearSessionCookie,
  cookiePolicyFor,
  serializeSessionCookie,
} from '../utils/session-cookie.ts';

export type SessionRequestContext = RequestContext & { sessionId?: string };

/** The signed-in actor and its per-request authorization, or 401. */
export function contextOf(request: FastifyRequest): SessionRequestContext {
  if (!request.actor || !request.authz) throw new UnauthenticatedError();
  return {
    actor: request.actor,
    authz: request.authz,
    ip: request.ip,
    requestId: request.id,
    ...(request.sessionId ? { sessionId: request.sessionId } : {}),
  };
}

/** Client details recorded on sessions and audit rows of anonymous requests. */
export function clientOf(request: FastifyRequest) {
  return { ip: request.ip, userAgent: request.headers['user-agent'], requestId: request.id };
}

export function setSessionCookie(reply: FastifyReply, publicUrl: string, session: IssuedSession) {
  reply.header(
    'set-cookie',
    serializeSessionCookie(session.token, session.expiresAt, cookiePolicyFor(publicUrl)),
  );
}

export function clearSession(reply: FastifyReply, publicUrl: string) {
  reply.header('set-cookie', clearSessionCookie(cookiePolicyFor(publicUrl)));
}
