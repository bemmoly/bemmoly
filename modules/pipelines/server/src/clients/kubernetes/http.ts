import type { z } from 'zod';

/*
 * The one way Pipelines talks to a Kubernetes API server: a bearer token from a token source,
 * a hard timeout on every request, the server's Status answer turned into KubernetesApiError,
 * and every answer parsed with the caller's schema. The transport is fetch-shaped and
 * injectable: the real one trusts only the cluster's own certificate authority, and tests
 * replay recorded answers through the same shape as the Google Cloud clients.
 */

export interface KubernetesTransportInit {
  method: string;
  headers: Record<string, string>;
  body?: string;
  signal: AbortSignal;
}

export type KubernetesTransport = (url: string, init: KubernetesTransportInit) => Promise<Response>;

export interface KubernetesTokenSource {
  token(): Promise<string>;
}

export class KubernetesApiError extends Error {
  override readonly name = 'KubernetesApiError';
  readonly status: number;
  /** The server's machine reason ("Forbidden", "NotFound", "AlreadyExists"), when it sent one. */
  readonly reason: string | null;
  readonly url: string;

  constructor(url: string, status: number, message: string, reason: string | null) {
    super(message);
    this.url = url;
    this.status = status;
    this.reason = reason;
  }
}

export type KubernetesMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface KubernetesRequest<T> {
  method?: KubernetesMethod;
  /** Absolute path on the API server, "/apis/apps/v1/namespaces/shop/deployments/web". */
  path: string;
  query?: Readonly<Record<string, string | undefined>>;
  body?: unknown;
  /** Server-side apply sends its own patch type; everything else is JSON. */
  contentType?: string;
  schema: z.ZodType<T>;
}

export interface KubernetesHttp {
  send<T>(request: KubernetesRequest<T>): Promise<T>;
  /** As send, but a 404 answers null. */
  find<T>(request: KubernetesRequest<T>): Promise<T | null>;
}

export interface KubernetesHttpOptions {
  /** "https://34.118.10.2": the cluster's control plane. */
  endpoint: string;
  tokens: KubernetesTokenSource;
  transport: KubernetesTransport;
  timeoutMs?: number;
}

export const KUBERNETES_TIMEOUT_MS = 20_000;

const statusOf = (text: string): { message: string; reason: string | null } => {
  try {
    const parsed = JSON.parse(text) as { message?: string; reason?: string };
    return { message: parsed.message ?? text.slice(0, 300), reason: parsed.reason ?? null };
  } catch {
    return { message: text.slice(0, 300), reason: null };
  }
};

export function createKubernetesHttp(options: KubernetesHttpOptions): KubernetesHttp {
  const timeoutMs = options.timeoutMs ?? KUBERNETES_TIMEOUT_MS;
  const base = options.endpoint.startsWith('https://')
    ? options.endpoint
    : `https://${options.endpoint}`;

  async function send<T>(request: KubernetesRequest<T>): Promise<T> {
    const url = new URL(request.path, base);
    for (const [key, value] of Object.entries(request.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, value);
    }
    const headers: Record<string, string> = {
      accept: 'application/json',
      authorization: `Bearer ${await options.tokens.token()}`,
    };
    if (request.body !== undefined)
      headers['content-type'] = request.contentType ?? 'application/json';
    const response = await options.transport(url.toString(), {
      method: request.method ?? 'GET',
      headers,
      ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await response.text();
    if (response.status < 200 || response.status >= 300) {
      const { message, reason } = statusOf(text);
      throw new KubernetesApiError(url.toString(), response.status, message, reason);
    }
    return request.schema.parse(text.length === 0 ? {} : JSON.parse(text));
  }

  return {
    send,
    async find(request) {
      try {
        return await send(request);
      } catch (error) {
        if (error instanceof KubernetesApiError && error.status === 404) return null;
        throw error;
      }
    },
  };
}
