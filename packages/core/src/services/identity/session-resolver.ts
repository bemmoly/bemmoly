import type { Database } from '../../clients/drizzle.ts';
import type { SessionResolver } from '../../contracts/session-resolver.ts';
import { isSameOrigin, requestOrigin } from '../../utils/origin.ts';
import { readCookie, SESSION_COOKIE } from '../../utils/session-cookie.ts';
import { authenticateSession } from './sessions.ts';

/**
 * Authenticates WebSocket upgrades (/ws, /collab) from the session cookie. It
 * never rotates or slides the session, because an upgrade response cannot set
 * a cookie; the next REST call does that.
 */
export function createSessionResolver(deps: {
  db: Database;
  publicUrl: string;
  now?: () => Date;
}): SessionResolver {
  return {
    async resolve(headers) {
      const token = readCookie(headers.cookie, SESSION_COOKIE);
      if (!token) return null;
      const now = deps.now ? deps.now() : new Date();
      const session = await authenticateSession(deps.db, token, {}, now, { readOnly: true });
      if (!session) return null;
      return {
        actor: { kind: 'user', id: session.userId },
        sessionId: session.sessionId,
        expiresAt: session.expiresAt,
      };
    },
    isAllowedOrigin(headers) {
      const origin = requestOrigin(headers);
      const host = Array.isArray(headers.host) ? headers.host[0] : headers.host;
      if (!origin) return false;
      const protocol = origin.startsWith('https:') ? 'https' : 'http';
      return isSameOrigin(origin, deps.publicUrl, { protocol, host });
    },
  };
}
