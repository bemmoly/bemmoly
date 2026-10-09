import { ToastProvider } from '@bemmoly/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup } from '@testing-library/react';
import { http, HttpResponse, type HttpHandler } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll } from 'vitest';

/*
 * The Backlog tests' backend: MSW on a fixed origin, with every route a test
 * does not answer failing as an unknown route does, and a recorder for the
 * writes so a test can read the calls in the order they were made.
 */

export interface Call {
  method: string;
  path: string;
  body: unknown;
}

export function startServer(...handlers: HttpHandler[]) {
  const calls: Call[] = [];
  const server = setupServer(
    ...handlers,
    http.all('*/api/v1/*', ({ request }) =>
      HttpResponse.json(
        { code: 'not_found', message: `No route for ${request.method}`, requestId: 't' },
        { status: 404 },
      ),
    ),
  );
  server.events.on('request:start', async ({ request }) => {
    if (request.method === 'GET') return;
    const text = await request.clone().text();
    calls.push({
      method: request.method,
      path: new URL(request.url).pathname,
      body: text ? (JSON.parse(text) as unknown) : undefined,
    });
  });
  beforeAll(() => {
    (window as { happyDOM?: { setURL(url: string): void } }).happyDOM?.setURL(
      'http://bemmoly.test/',
    );
    server.listen({ onUnhandledFrame: 'bypass' } as never);
  });
  afterEach(() => {
    cleanup();
    server.resetHandlers();
    calls.length = 0;
  });
  afterAll(() => server.close());
  return { server, calls };
}

export function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
}

/** The query cache and the toast stack, as the shell gives a module chunk. */
export function providers(client: QueryClient) {
  return function Providers({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    );
  };
}
