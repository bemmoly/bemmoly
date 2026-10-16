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

/** A product's own web app, served under its base on the same origin (Pipelines at /pipelines). */
export interface ProductWeb {
  /** "/pipelines": no trailing slash. */
  base: string;
  root: string;
}

const productOf = (url: string, products: readonly ProductWeb[]) =>
  products.find((product) => url === product.base || url.startsWith(`${product.base}/`));

/**
 * Serves each product's build under its base, before Bemmoly's own app claims every other
 * path. Unknown GETs under a base fall back to that product's index.html, so its client-side
 * routes load; /pipelines without the slash goes to /pipelines/.
 */
async function registerProductApps(app: FastifyInstance, products: readonly ProductWeb[]) {
  for (const product of products) {
    await app.register(fastifyStatic, {
      root: product.root,
      prefix: `${product.base}/`,
      index: ['index.html'],
      decorateReply: false,
      setHeaders(res, filePath) {
        res.header('cache-control', filePath.includes('/assets/') ? IMMUTABLE : REVALIDATE);
      },
    });
  }
}

async function sendProductIndex(reply: FastifyReply, product: ProductWeb, url: string) {
  if (url === product.base) return reply.redirect(`${product.base}/`);
  reply.header('cache-control', REVALIDATE);
  return reply.sendFile('index.html', product.root);
}

/**
 * Serves the web build under `/`. Unknown non-API GETs fall back to index.html
 * so client-side routes such as /work/board load the shell.
 */
export async function registerWebApp(
  app: FastifyInstance,
  root: string,
  products: readonly ProductWeb[] = [],
): Promise<void> {
  const served = products.filter((product) => hasWebBuild(product.root));
  await registerProductApps(app, served);
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
    const product = productOf(request.url.split('?')[0] ?? '', served);
    if (product) return sendProductIndex(reply, product, request.url.split('?')[0] ?? '');
    reply.header('cache-control', REVALIDATE);
    return reply.sendFile('index.html');
  });
}
