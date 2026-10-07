import { ForbiddenError } from '@bemmoly/shared';
import fp from 'fastify-plugin';
import { isSameOrigin, requestOrigin } from '../utils/origin.ts';
import { readCookie, SESSION_COOKIE } from '../utils/session-cookie.ts';

export interface CsrfOptions {
  publicUrl: string;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * SameSite=Lax cookies stop most cross-site writes; this closes the rest by
 * checking where every state-changing request came from. Bearer requests are
 * exempt: a token is never sent ambiently by a browser.
 */
export const csrfProtection = fp<CsrfOptions>(
  async (app, options) => {
    app.addHook('onRequest', async (request) => {
      if (SAFE_METHODS.has(request.method) || request.headers.authorization) return;
      if (request.headers['sec-fetch-site'] === 'cross-site') {
        throw new ForbiddenError('Cross-site requests are not allowed');
      }
      const origin = requestOrigin(request.headers);
      if (origin) {
        const target = { protocol: request.protocol, host: request.host };
        if (!isSameOrigin(origin, options.publicUrl, target)) {
          throw new ForbiddenError('Cross-site requests are not allowed');
        }
        return;
      }
      // Browsers always send Origin on these requests, so a cookie without one is not trusted.
      if (readCookie(request.headers.cookie, SESSION_COOKIE)) {
        throw new ForbiddenError('A request that changes data must carry an Origin header');
      }
    });
  },
  { name: 'bemmoly-csrf', fastify: '5.x' },
);
