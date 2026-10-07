import type { IncomingHttpHeaders } from 'node:http';
import { UnauthenticatedError } from '@bemmoly/shared';
import type { AuthenticateRequest } from '../contracts/authn.ts';
import type { SessionResolver } from '../contracts/session-resolver.ts';

export interface RequestWithHeaders {
  headers: IncomingHttpHeaders;
}

/**
 * The acting user or token for a request, or a 401: the identity service's
 * AuthenticateRequest, which the host passes when wired.
 */
export type ActorResolver = AuthenticateRequest;

/**
 * Session-cookie authentication only, for when the host has a SessionResolver
 * but no full authenticate function. Without either, every request is a 401.
 */
export function createActorResolver(sessions: SessionResolver | undefined): ActorResolver {
  return async (request: RequestWithHeaders) => {
    const session = sessions ? await sessions.resolve(request.headers) : null;
    if (!session) throw new UnauthenticatedError();
    return session.actor;
  };
}
