import type { z } from 'zod';
import { ApiError, errorFromResponse } from './errors.ts';
import { xhrUpload, type UploadProgressOptions } from './xhr-upload.ts';

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
  /** A file sent as the raw request body instead of JSON. */
  raw?: Blob;
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
  upload<S extends z.ZodType>(
    path: string,
    schema: S,
    file: Blob,
    query?: Query,
    /** With onProgress, sent so the browser reports how much has gone. */
    progress?: UploadProgressOptions,
  ): Promise<z.output<S>>;
  url(path: string, query?: Query): string;
  /**
   * A streamed NDJSON response, one parsed value per line as it arrives. An error status
   * before the stream starts throws the usual ApiError; a malformed line throws
   * invalid_response.
   */
  lines<S extends z.ZodType>(
    path: string,
    schema: S,
    options?: RequestOptions,
  ): AsyncGenerator<z.output<S>, void, undefined>;
}

function assertRelativePath(path: string): void {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new TypeError(`API paths must be same-origin and start with "/" (got "${path}")`);
  }
}

/**
 * A random v4 UUID. crypto.randomUUID exists only in secure contexts (HTTPS or localhost),
 * so a server reached over plain HTTP on a LAN address falls back to getRandomValues.
 */
export function randomKey(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const UNEXPECTED = 'The server answered in a way this page did not expect. Reload and try again.';

/** Anything that is not already an ApiError becomes one, so screens never show a raw JS error. */
function asApiError(cause: unknown): ApiError {
  if (cause instanceof ApiError) return cause;
  return new ApiError(
    0,
    'client_error',
    'Something went wrong on this page. Reload and try again.',
    {
      cause,
    },
  );
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

  async function open(path: string, init: RequestOptions, accept: string): Promise<Response> {
    try {
      return await openUnsafe(path, init, accept);
    } catch (cause) {
      if (init.signal?.aborted) throw cause;
      throw asApiError(cause);
    }
  }

  async function openUnsafe(path: string, init: RequestOptions, accept: string): Promise<Response> {
    const headers: Record<string, string> = { accept };
    if (init.raw) headers['content-type'] = 'application/octet-stream';
    else if (init.body !== undefined) headers['content-type'] = 'application/json';
    if (init.idempotent) headers['idempotency-key'] = randomKey();
    let response: Response;
    try {
      response = await doFetch(url(path, init.query), {
        method: init.method ?? 'GET',
        headers,
        credentials: 'include',
        ...(init.raw
          ? { body: init.raw }
          : init.body === undefined
            ? {}
            : { body: JSON.stringify(init.body) }),
        ...(init.signal ? { signal: init.signal } : {}),
      });
    } catch (cause) {
      if (init.signal?.aborted) throw cause;
      throw new ApiError(0, 'network_error', 'Bemmoly could not reach the server.', { cause });
    }
    if (!response.ok) {
      const error = errorFromResponse(response, await readJson(response));
      if (error.status === 401) options.onUnauthenticated?.(error);
      throw error;
    }
    return response;
  }

  async function call(path: string, init: RequestOptions): Promise<unknown> {
    return readJson(await open(path, init, 'application/json'));
  }

  function parseLine<S extends z.ZodType>(schema: S, line: string): z.output<S> {
    let value: unknown;
    try {
      value = JSON.parse(line) as unknown;
    } catch {
      value = undefined;
    }
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      throw new ApiError(200, 'invalid_response', UNEXPECTED);
    }
    return parsed.data;
  }

  return {
    url,
    async request(path, schema, init = {}) {
      const body = await call(path, init);
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        throw new ApiError(200, 'invalid_response', UNEXPECTED, {
          details: parsed.error.issues,
        });
      }
      return parsed.data;
    },
    async send(path, init = {}) {
      await call(path, init);
    },
    async *lines(path, schema, init = {}) {
      const response = await open(path, init, 'application/x-ndjson');
      if (!response.body) return;
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += value;
          let end = buffer.indexOf('\n');
          while (end >= 0) {
            const line = buffer.slice(0, end).trim();
            buffer = buffer.slice(end + 1);
            if (line) yield parseLine(schema, line);
            end = buffer.indexOf('\n');
          }
        }
        if (buffer.trim()) yield parseLine(schema, buffer.trim());
      } finally {
        reader.releaseLock();
      }
    },
    async upload(path, schema, file, query, progress) {
      if (!progress?.onProgress || typeof XMLHttpRequest === 'undefined') {
        return this.request(path, schema, {
          method: 'POST',
          raw: file,
          ...(query ? { query } : {}),
          ...(progress?.signal ? { signal: progress.signal } : {}),
        });
      }
      const body = await xhrUpload(url(path, query), file, progress, options.onUnauthenticated);
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        throw new ApiError(200, 'invalid_response', UNEXPECTED, {
          details: parsed.error.issues,
        });
      }
      return parsed.data;
    },
  };
}
