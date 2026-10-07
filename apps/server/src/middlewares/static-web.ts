import { existsSync } from 'node:fs';
import { join } from 'node:path';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { apiNotFoundHandler } from './error-handler.ts';

const IMMUTABLE = 'public, max-age=31536000, immutable';
const REVALIDATE = 'no-cache';

function isApiPath(url: string): boolean {
  return (
    url === '/api' ||
    url.startsWith('/api/') ||
    url.startsWith('/healthz') ||
    url.startsWith('/readyz')
  );
}

export function hasWebBuild(root: string): boolean {
  return existsSync(join(root, 'index.html'));
}

/**
 * Serves the web build under `/`. Unknown non-API GETs fall back to index.html
 * so client-side routes such as /sample load the shell.
 */
export async function registerWebApp(app: FastifyInstance, root: string): Promise<void> {
  await app.register(fastifyStatic, {
    root,
    prefix: '/',
    index: ['index.html'],
    /** The web build ships .br and .gz beside each asset; serve those to clients that accept them. */
    preCompressed: true,
    setHeaders(res, filePath) {
      res.header('cache-control', filePath.includes('/assets/') ? IMMUTABLE : REVALIDATE);
    },
  });
  app.setNotFoundHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.method !== 'GET' || isApiPath(request.url)) return apiNotFoundHandler(request);
    reply.header('cache-control', REVALIDATE);
    return reply.sendFile('index.html');
  });
}
