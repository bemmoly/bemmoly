import type { MockDb } from './db.ts';

export interface MockRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
  params: Readonly<Record<string, string>>;
}

export interface MockResponse {
  status: number;
  /** JSON, or a string sent as is with `headers` (a file download). */
  body?: unknown;
  headers?: Record<string, string>;
}

export type MockHandler = (request: MockRequest, db: MockDb) => MockResponse;

export interface MockRoute {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Express-style: "/api/v1/users/:id". */
  pattern: string;
  /** Anonymous routes answer without a session, as on the server. */
  anonymous?: boolean;
  handle: MockHandler;
}

let counter = 0;

export function ok(body?: unknown, status = 200): MockResponse {
  return body === undefined ? { status: 204 } : { status, body };
}

export function fail(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): MockResponse {
  counter += 1;
  return {
    status,
    body: { code, message, requestId: `mock-${counter}`, ...(details ? { details } : {}) },
  };
}

export const notFound = (what: string) => fail(404, 'not_found', `${what} was not found`);

export function invalid(path: string, message: string): MockResponse {
  return fail(400, 'validation_failed', 'The request is not valid', {
    issues: [{ path, code: 'custom', message }],
  });
}

export function bodyOf<T>(request: MockRequest): Partial<T> {
  return (request.body ?? {}) as Partial<T>;
}

/** Keyset-style paging over an in-memory list; the cursor is the next index. */
export function page<T>(items: readonly T[], request: MockRequest, fallbackLimit = 50) {
  const start = Number(request.query.get('cursor') ?? '0') || 0;
  const limit = Number(request.query.get('limit') ?? fallbackLimit) || fallbackLimit;
  const slice = items.slice(start, start + limit);
  const next = start + limit < items.length ? String(start + limit) : null;
  return { items: slice, nextCursor: next };
}
