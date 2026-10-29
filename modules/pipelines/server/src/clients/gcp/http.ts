import type { z } from 'zod';

/*
 * The one way Pipelines talks to Google Cloud's REST APIs: a bearer token from a token
 * source, a hard timeout on every request, Google's error envelope turned into GcpApiError,
 * and every answer parsed with the caller's schema so vendor shapes stop at the client. The
 * transport is fetch-shaped and injectable, so tests replay recorded answers instead of
 * reaching the network.
 */

export interface GcpTransportInit {
  method: string;
  headers: Record<string, string>;
  body?: string;
  signal: AbortSignal;
}

export type GcpTransport = (url: string, init: GcpTransportInit) => Promise<Response>;

/** Hands out a current access token; implementations cache and refresh. */
export interface GcpTokenSource {
  token(): Promise<string>;
  /**
   * The project a person's own credentials bill API quota to. Google refuses some APIs for
   * user credentials without one; service accounts never need it.
   */
  quotaProject?(): Promise<string | null>;
}

export class GcpApiError extends Error {
  override readonly name = 'GcpApiError';
  readonly status: number;
  /** Google's machine reason ("PERMISSION_DENIED", "ALREADY_EXISTS"), when it sent one. */
  readonly reason: string | null;
  readonly url: string;

  constructor(url: string, status: number, message: string, reason: string | null) {
    super(message);
    this.url = url;
    this.status = status;
    this.reason = reason;
  }
}

export type GcpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type GcpQuery = Readonly<Record<string, string | number | boolean | undefined>>;

export interface GcpRequest<T> {
  method?: GcpMethod;
  url: string;
  query?: GcpQuery;
  body?: unknown;
  schema: z.ZodType<T>;
}

export interface GcpHttp {
  send<T>(request: GcpRequest<T>): Promise<T>;
  /** As send, but a 404 answers null: "does it exist yet" is a normal question here. */
  find<T>(request: GcpRequest<T>): Promise<T | null>;
}

export interface GcpHttpOptions {
  tokens: GcpTokenSource;
  transport?: GcpTransport;
  timeoutMs?: number;
}

export const GCP_TIMEOUT_MS = 20_000;

const errorEnvelope = (text: string): { message: string; reason: string | null } => {
  try {
    const parsed = JSON.parse(text) as {
      error?: { message?: string; status?: string; details?: Array<{ reason?: string }> };
    };
    const reason = parsed.error?.details?.find((detail) => detail.reason)?.reason;
    return {
      message: parsed.error?.message ?? text.slice(0, 300),
      reason: reason ?? parsed.error?.status ?? null,
    };
  } catch {
    return { message: text.slice(0, 300), reason: null };
  }
};

export function urlWithQuery(url: string, query: GcpQuery = {}): string {
  const target = new URL(url);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) target.searchParams.set(key, String(value));
  }
  return target.toString();
}

const defaultTransport: GcpTransport = (url, init) => fetch(url, init);

export function createGcpHttp(options: GcpHttpOptions): GcpHttp {
  const transport = options.transport ?? defaultTransport;
  const timeoutMs = options.timeoutMs ?? GCP_TIMEOUT_MS;

  async function raw(request: GcpRequest<unknown>): Promise<{ status: number; text: string }> {
    const url = urlWithQuery(request.url, request.query);
    const headers: Record<string, string> = {
      accept: 'application/json',
      authorization: `Bearer ${await options.tokens.token()}`,
    };
    const quotaProject = await options.tokens.quotaProject?.();
    if (quotaProject) headers['x-goog-user-project'] = quotaProject;
    if (request.body !== undefined) headers['content-type'] = 'application/json';
    const response = await transport(url, {
      method: request.method ?? 'GET',
      headers,
      ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { status: response.status, text: await response.text() };
  }

  async function send<T>(request: GcpRequest<T>): Promise<T> {
    const { status, text } = await raw(request);
    if (status < 200 || status >= 300) {
      const { message, reason } = errorEnvelope(text);
      throw new GcpApiError(request.url, status, message, reason);
    }
    return request.schema.parse(text.length === 0 ? {} : JSON.parse(text));
  }

  return {
    send,
    async find(request) {
      try {
        return await send(request);
      } catch (error) {
        if (error instanceof GcpApiError && error.status === 404) return null;
        throw error;
      }
    },
  };
}
