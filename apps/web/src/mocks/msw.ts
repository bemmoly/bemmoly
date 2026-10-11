import { bypass, http, HttpResponse, passthrough, ws, type AnyHandler } from 'msw';
import type { MockApi } from './dispatch.ts';
import { mockPresence } from './presence.ts';
import type { MockResponse } from './types.ts';
import { LOGO_FILE_PATH, LOGO_UPLOAD_PATH, servedLogo, uploadLogo } from './logo.ts';
import { mockUploadHandler } from './uploads.ts';

export interface MswOptions {
  /** Ask the real server first and mock only routes it does not have yet (dev). */
  fallback: boolean;
  /** Called after every mocked request, e.g. to persist the mock database. */
  onChange?: () => void;
}

/** The server's answer for a route nobody registered: 404 "No route for …". */
export async function isMissingRoute(response: Response): Promise<boolean> {
  if (response.status !== 404) return false;
  const body = (await response
    .clone()
    .json()
    .catch(() => null)) as { message?: unknown } | null;
  return typeof body?.message === 'string' && body.message.startsWith('No route for');
}

async function readBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** A body that arrives line by line, `delayMs` apart: a streamed AI reply. */
function lineStream(text: string, delayMs: number): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const lines = text.split(/(?<=\n)/);
  return new ReadableStream({
    async pull(controller) {
      const line = lines.shift();
      if (line === undefined) {
        controller.close();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      controller.enqueue(encoder.encode(line));
    },
  });
}

export function toResponse(result: MockResponse): Response {
  if (result.body === undefined) return new HttpResponse(null, { status: result.status });
  if (result.lineDelayMs && typeof result.body === 'string') {
    return new HttpResponse(lineStream(result.body, result.lineDelayMs), {
      status: result.status,
      ...(result.headers ? { headers: result.headers } : {}),
    });
  }
  if (result.headers && typeof result.body === 'string') {
    return new HttpResponse(result.body, { status: result.status, headers: result.headers });
  }
  return HttpResponse.json(result.body as Record<string, unknown>, { status: result.status });
}

const realtime = ws.link(/\/ws$/);
const collab = ws.link(/\/collab$/);

/** The close code the Docs collab client reads as "no collab server: edit locally". */
export const NO_COLLAB_SERVER = 4404;

/** True when a real server answers behind the dev proxy (its probes speak JSON). */
async function realServerUp(): Promise<boolean> {
  const probe = await fetch(bypass(new URL('/readyz', window.location.origin))).catch(() => null);
  return Boolean(probe?.headers.get('content-type')?.includes('application/json'));
}

/** Sends queued realtime events to every open socket. */
export function flushRealtime(api: MockApi): void {
  for (const [kind, userId, ids] of api.db.outbound.splice(0)) {
    const message = { kind, ids, ...(userId ? { userId } : {}) };
    realtime.broadcast(JSON.stringify({ type: 'invalidate', message }));
  }
}

export function mswHandlers(api: MockApi, options: MswOptions): AnyHandler[] {
  /** Whether a real server answers; unknown for the moment the probe takes. */
  let realServer: boolean | null = options.fallback ? null : false;
  if (options.fallback) {
    void realServerUp().then((up) => {
      realServer = up;
    });
  }
  return [
    mockUploadHandler(api, options.fallback),
    // The logo's body is bytes, which the JSON dispatcher below cannot read.
    http.post(LOGO_UPLOAD_PATH, async ({ request }) => {
      if (options.fallback) {
        const real = await fetch(bypass(request.clone())).catch(() => null);
        if (real && !(await isMissingRoute(real))) return real;
      }
      const result = uploadLogo(api.db, new Uint8Array(await request.arrayBuffer()));
      options.onChange?.();
      return toResponse(result);
    }),
    http.get(LOGO_FILE_PATH, async ({ request }) => {
      if (options.fallback) {
        const real = await fetch(bypass(request.clone())).catch(() => null);
        if (real && !(await isMissingRoute(real))) return real;
      }
      const logo = servedLogo(api.db, request.url);
      if (!logo) return new HttpResponse(null, { status: 404 });
      return new HttpResponse(logo.bytes, { headers: { 'content-type': logo.mime } });
    }),
    http.all(/\/(api\/v1\/|readyz$)/, async ({ request }) => {
      if (options.fallback) {
        const real = await fetch(bypass(request)).catch(() => null);
        if (real && !(await isMissingRoute(real))) return real;
      }
      const result = api.dispatch(request.method, request.url, await readBody(request.clone()));
      if (!result)
        return options.fallback
          ? passthrough()
          : HttpResponse.json(
              {
                code: 'not_found',
                message: `No route for ${request.method} ${new URL(request.url).pathname}`,
                requestId: 'mock',
              },
              { status: 404 },
            );
      flushRealtime(api);
      options.onChange?.();
      return toResponse(result);
    }),
    // Collaborative editing needs the real server; without one the page edits locally. The
    // choice is made synchronously: a client's first messages are lost if connect() waits.
    collab.addEventListener('connection', ({ client, server }) => {
      if (realServer === true) server.connect();
      else if (realServer === false) client.close(NO_COLLAB_SERVER, 'No collaboration server');
      else client.close(1013, 'Try again');
    }),
    realtime.addEventListener('connection', ({ client, server }) => {
      // With a real backend behind, its events still arrive; mock events are added on top.
      if (options.fallback) server.connect();
      client.addEventListener('message', (event) => {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : null;
        if (data?.type === 'subscribe') {
          client.send(JSON.stringify({ type: 'subscribed', scope: data.scope }));
        }
        // A real backend behind answers presence itself; two answers would fight.
        const presence = options.fallback ? null : mockPresence(api.db, data);
        if (presence) client.send(JSON.stringify(presence));
      });
    }),
  ];
}
