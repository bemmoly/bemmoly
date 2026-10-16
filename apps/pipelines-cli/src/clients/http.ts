import type { z } from 'zod';
import { apiErrorBodySchema, CliError, oauthErrorBodySchema } from '../cli/errors.ts';

/*
 * One HTTP client for every call bp makes: an absolute base URL, a Bearer token, a timeout
 * on every request, and responses parsed with the shared contracts, so a server that
 * answers in an unexpected shape is reported instead of half-printed.
 */

export const DEFAULT_TIMEOUT_MS = 30_000;

export type QueryValue = string | number | boolean | undefined;

export interface HttpOptions {
  baseUrl: string;
  token?: string | undefined;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  query?: Readonly<Record<string, QueryValue>>;
  body?: unknown;
  /** application/x-www-form-urlencoded instead of JSON (the OAuth endpoints). */
  form?: Readonly<Record<string, string>>;
  timeoutMs?: number;
}

export interface Http {
  baseUrl: string;
  request<S extends z.ZodType>(
    path: string,
    schema: S,
    options?: RequestOptions,
  ): Promise<z.output<S>>;
  send(path: string, options?: RequestOptions): Promise<void>;
  url(path: string, query?: RequestOptions['query']): string;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const trimSlashes = (url: string) => url.replace(/\/+$/, '');

export function createHttp(options: HttpOptions): Http {
  const baseUrl = trimSlashes(options.baseUrl);
  const doFetch = options.fetch ?? fetch;

  function url(path: string, query: RequestOptions['query'] = {}): string {
    const target = new URL(`${baseUrl}${path}`);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) target.searchParams.set(key, String(value));
    }
    return target.toString();
  }

  async function call(path: string, request: RequestOptions): Promise<Response> {
    const timeoutMs = request.timeoutMs ?? options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const headers: Record<string, string> = { accept: 'application/json', 'user-agent': 'bp' };
    if (options.token) headers.authorization = `Bearer ${options.token}`;
    let body: string | undefined;
    if (request.form) {
      headers['content-type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(request.form).toString();
    } else if (request.body !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(request.body);
    }
    const target = url(path, request.query);
    let response: Response;
    try {
      response = await doFetch(target, {
        method: request.method ?? (body === undefined ? 'GET' : 'POST'),
        headers,
        ...(body === undefined ? {} : { body }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (cause) {
      const timedOut = cause instanceof DOMException && cause.name === 'TimeoutError';
      throw new CliError(
        timedOut
          ? `${baseUrl} did not answer within ${Math.round(timeoutMs / 1000)} seconds. Check the address and try again.`
          : `Could not reach ${baseUrl}: ${(cause as Error).message}. Check the address and your network.`,
      );
    }
    if (response.ok) return response;
    const text = await response.text().catch(() => '');
    const parsed = parseJson(text);
    const oauth = oauthErrorBodySchema.safeParse(parsed);
    if (oauth.success) {
      throw new CliError(oauth.data.error_description ?? oauth.data.error, {
        status: response.status,
        oauth: oauth.data.error,
      });
    }
    const errorBody = apiErrorBodySchema.safeParse(parsed);
    if (errorBody.success) {
      throw new CliError(errorBody.data.message, { status: response.status, body: errorBody.data });
    }
    throw new CliError(`${baseUrl} answered ${response.status} ${response.statusText}.`, {
      status: response.status,
    });
  }

  return {
    baseUrl,
    url,
    async request(path, schema, request = {}) {
      const response = await call(path, request);
      const json: unknown = await response.json().catch(() => {
        throw new CliError(`${baseUrl} sent a response that is not JSON.`);
      });
      const parsed = schema.safeParse(json);
      if (!parsed.success) {
        throw new CliError(
          `${baseUrl} answered in a shape this version of bp does not know. Update bp, or check the server's version.`,
        );
      }
      return parsed.data;
    },
    async send(path, request = {}) {
      await call(path, request);
    },
  };
}
