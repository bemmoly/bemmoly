import type { z } from 'zod';
import { ApiError, errorFromResponse } from './errors.ts';

export type QueryValue = string | number | boolean | readonly string[] | null | undefined;
export type Query = Readonly<Record<string, QueryValue>>;

export interface HttpOptions {
  /** Same-origin prefix, "" by default. Absolute URLs are refused so cookies never leave. */
  baseUrl?: string;
  fetch?: typeof fetch;
  /** Called once per 401, for example to send the person to the login page. */
  onUnauthenticated?: (error: ApiError) => void;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
  /** POSTs that create may retry safely with the same key (stored for 24 hours server-side). */
  idempotent?: boolean;
}

export interface Http {
  request<S extends z.ZodType>(
    path: string,
    schema: S,
    options?: RequestOptions,
  ): Promise<z.output<S>>;
  send(path: string, options?: RequestOptions): Promise<void>;
  url(path: string, query?: Query): string;
}

function assertRelativePath(path: string): void {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new TypeError(`API paths must be same-origin and start with "/" (got "${path}")`);
  }
}

export function buildQuery(query: Query | undefined): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

async function readJson(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** The one authenticated fetch: session cookie, JSON in and out, errors normalised. */
export function createHttp(options: HttpOptions = {}): Http {
  const baseUrl = options.baseUrl ?? '';
  if (/^[a-z]+:\/\//i.test(baseUrl) || baseUrl.startsWith('//')) {
    throw new TypeError('baseUrl must be a same-origin path prefix, not an absolute URL');
  }
  const doFetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init));

  const url = (path: string, query?: Query) => {
    assertRelativePath(path);
    return `${baseUrl}${path}${buildQuery(query)}`;
  };

  async function call(path: string, init: RequestOptions): Promise<unknown> {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (init.body !== undefined) headers['content-type'] = 'application/json';
    if (init.idempotent) headers['idempotency-key'] = crypto.randomUUID();
    let response: Response;
    try {
      response = await doFetch(url(path, init.query), {
        method: init.method ?? 'GET',
        headers,
        credentials: 'include',
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
        ...(init.signal ? { signal: init.signal } : {}),
      });
    } catch (cause) {
      if (init.signal?.aborted) throw cause;
      throw new ApiError(0, 'network_error', 'Bemmoly could not reach the server.', { cause });
    }
    const body = await readJson(response);
    if (!response.ok) {
      const error = errorFromResponse(response, body);
      if (error.status === 401) options.onUnauthenticated?.(error);
      throw error;
    }
    return body;
  }

  return {
    url,
    async request(path, schema, init = {}) {
      const body = await call(path, init);
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        throw new ApiError(200, 'invalid_response', `Unexpected response from ${path}`, {
          details: parsed.error.issues,
        });
      }
      return parsed.data;
    },
    async send(path, init = {}) {
      await call(path, init);
    },
  };
}
