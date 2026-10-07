import type { Page, WebSocketRoute } from '@playwright/test';
import type { MockScenario } from '../../src/mocks/db.ts';
import { createMockApi, type MockApi } from '../../src/mocks/dispatch.ts';

export interface MockBackend {
  api: MockApi;
  /** Pushes a realtime invalidation to every open socket, as the server's hub would. */
  push(kind: string, ids?: string[]): void;
}

function bodyOf(postData: string | null): unknown {
  if (!postData) return undefined;
  try {
    return JSON.parse(postData) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Serves /api/v1 and /readyz from the same in-memory backend the dev server
 * and the unit tests use, and answers /ws with the realtime protocol. The
 * page itself (HTML, JS, CSS) still comes from the real server's build.
 */
export async function useMockBackend(page: Page, scenario: MockScenario = 'ready'): Promise<MockBackend> {
  const api = createMockApi(scenario);
  const sockets = new Set<WebSocketRoute>();
  const send = (message: unknown) => {
    for (const socket of sockets) socket.send(JSON.stringify(message));
  };
  const flush = () => {
    for (const [kind, userId, ids] of api.db.outbound.splice(0)) {
      send({ type: 'invalidate', message: { kind, ids, ...(userId ? { userId } : {}) } });
    }
  };

  await page.routeWebSocket(/\/ws$/, (socket) => {
    sockets.add(socket);
    socket.onMessage((raw) => {
      const data = bodyOf(String(raw)) as { type?: string; scope?: unknown } | undefined;
      if (data?.type === 'subscribe') socket.send(JSON.stringify({ type: 'subscribed', scope: data.scope }));
    });
    socket.onClose(() => sockets.delete(socket));
  });

  await page.route(/\/(api\/v1\/|readyz$)/, async (route) => {
    const request = route.request();
    const result = api.dispatch(request.method(), request.url(), bodyOf(request.postData()));
    flush();
    if (!result) {
      const path = new URL(request.url()).pathname;
      await route.fulfill({
        status: 404,
        json: { code: 'not_found', message: `No route for ${request.method()} ${path}`, requestId: 'e2e' },
      });
      return;
    }
    if (result.body === undefined) await route.fulfill({ status: result.status, body: '' });
    else await route.fulfill({ status: result.status, json: result.body });
  });

  return {
    api,
    push(kind, ids = []) {
      send({ type: 'invalidate', message: { kind, ids, userId: api.db.signedInAs ?? undefined } });
    },
  };
}
