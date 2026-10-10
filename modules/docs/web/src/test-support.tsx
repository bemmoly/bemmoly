import { ToastProvider } from '@bemmoly/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup } from '@testing-library/react';
import { http, HttpResponse, type HttpHandler } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll } from 'vitest';

/*
 * The Docs screen tests' backend: MSW on a fixed origin, every route a test
 * does not answer failing as an unknown route does, and a recorder for the
 * writes so a test can read the calls in order. As Work's tests do.
 */

export interface Call {
  method: string;
  path: string;
  body: unknown;
}

export const ORIGIN = 'http://bemmoly.test';

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
    (window as { happyDOM?: { setURL(url: string): void } }).happyDOM?.setURL(`${ORIGIN}/`);
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

let seq = 0;
/** A uuid-shaped id the response schemas accept. */
export const id = (n = ++seq) => `0199c0de-0000-7000-8000-${String(n).padStart(12, '0')}`;
const at = '2026-10-01T10:00:00.000Z';

export const SPACE_ID = id(9001);

export function space(overrides: Record<string, unknown> = {}) {
  return {
    id: SPACE_ID,
    key: 'ENG',
    name: 'Engineering',
    description: null,
    icon: null,
    color: 'accent',
    teamId: null,
    projectId: null,
    aiExcluded: false,
    homePageId: null,
    pageCount: 3,
    archivedAt: null,
    createdAt: at,
    updatedAt: at,
    ...overrides,
  };
}

export function summary(title: string, overrides: Record<string, unknown> = {}) {
  return {
    id: id(),
    spaceId: SPACE_ID,
    spaceKey: 'ENG',
    parentId: null,
    position: 'n',
    depth: 0,
    title,
    icon: null,
    status: 'draft',
    ownerId: null,
    hasChildren: false,
    wordCount: 0,
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
    ...overrides,
  };
}

export const listed = (items: unknown[]) => ({ items, nextCursor: null });
