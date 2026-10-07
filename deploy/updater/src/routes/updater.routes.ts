import type { IncomingMessage } from 'node:http';
import type { Reply, UpdaterController } from '../controllers/updater.controller.ts';
import { tokenMatches } from '../controllers/updater.controller.ts';

const MAX_BODY = 16 * 1024;

async function readJson(request: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new Error('body too large');
    chunks.push(chunk as Buffer);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? (JSON.parse(text) as unknown) : {};
}

/**
 * The whole API: status, update and rollback, each with the shared token. Anything else
 * that is a GET gets the read-only progress page, which is what the proxy shows while
 * the app is down. There is no other route and no published port.
 */
export async function route(
  controller: UpdaterController,
  token: string,
  request: IncomingMessage,
): Promise<Reply> {
  const path = (request.url ?? '/').split('?')[0];
  if (path === '/healthz') return { status: 200, body: { status: 'ok' } };
  if (path?.startsWith('/v1/')) {
    if (!tokenMatches(request.headers.authorization, token)) {
      return {
        status: 401,
        body: { code: 'unauthenticated', message: 'A valid updater token is required' },
      };
    }
    if (request.method === 'GET' && path === '/v1/status') return controller.status();
    if (request.method === 'POST' && path === '/v1/update')
      return controller.update(await readJson(request));
    if (request.method === 'POST' && path === '/v1/rollback')
      return controller.rollback(await readJson(request));
    return { status: 404, body: { code: 'not_found', message: 'Unknown updater call' } };
  }
  if (request.method === 'GET' || request.method === 'HEAD') return controller.progressPage();
  return { status: 405, body: { code: 'bad_request', message: 'Method not allowed' } };
}
