import { bypass, http, HttpResponse, passthrough, ws, type AnyHandler } from 'msw';
import type { MockApi } from './dispatch.ts';
import type { MockResponse } from './types.ts';

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

export function toResponse(result: MockResponse): Response {
  if (result.body === undefined) return new HttpResponse(null, { status: result.status });
  return HttpResponse.json(result.body as Record<string, unknown>, { status: result.status });
}

const realtime = ws.link(/\/ws$/);

/** Sends queued realtime events to every open socket. */
export function flushRealtime(api: MockApi): void {
  for (const [kind, scope, ids] of api.db.outbound.splice(0)) {
    realtime.broadcast(JSON.stringify({ type: 'event', kind, scope, ids }));
  }
}

export function mswHandlers(api: MockApi, options: MswOptions): AnyHandler[] {
  return [
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
    realtime.addEventListener('connection', ({ client, server }) => {
      // With a real backend behind, its events still arrive; mock events are added on top.
      if (options.fallback) server.connect();
      client.addEventListener('message', (event) => {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : null;
        if (data?.type === 'subscribe') {
          client.send(JSON.stringify({ type: 'subscribed', scopes: data.scopes }));
        }
      });
    }),
  ];
}
