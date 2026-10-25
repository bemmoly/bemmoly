import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { LinkPreview } from '@bemmoly/core';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { apiNotFoundHandler } from './error-handler.ts';
import { withLinkPreview } from './link-preview-html.ts';

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

/** The preview a shared link shows for a web path; null leaves the shell's own tags. */
export type LinkPreviewLookup = (path: string) => Promise<LinkPreview | null>;

/**
 * index.html naming the record the path opens, for chat apps that fetch a shared link signed
 * out. Null when there is nothing to name; a failed lookup is logged and serves the plain shell,
 * so a preview can never stop the app from loading.
 */
async function previewedIndex(
  request: FastifyRequest,
  root: string,
  preview: LinkPreviewLookup,
  path: string,
): Promise<string | null> {
  try {
    const found = await preview(path);
    if (!found) return null;
    return withLinkPreview(await readFile(join(root, 'index.html'), 'utf8'), found);
  } catch (error) {
    request.log.warn({ err: error, path }, 'link preview failed; serving the plain shell');
    return null;
  }
}

/**
 * Serves the web build under `/`. Unknown non-API GETs fall back to index.html
 * so client-side routes such as /work/board load the shell.
 */
export async function registerWebApp(
  app: FastifyInstance,
  root: string,
  products: readonly ProductWeb[] = [],
  preview?: LinkPreviewLookup,
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
    const path = request.url.split('?')[0] ?? '';
    const product = productOf(path, served);
    if (product) return sendProductIndex(reply, product, path);
    reply.header('cache-control', REVALIDATE);
    const html = preview ? await previewedIndex(request, root, preview, path) : null;
    if (html) return reply.type('text/html; charset=utf-8').send(html);
    return reply.sendFile('index.html');
  });
}
