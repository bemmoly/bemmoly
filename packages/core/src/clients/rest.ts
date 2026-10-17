import { HttpStatusError } from './http-json.ts';

/*
 * A JSON REST client for importers and other outbound integrations: every call has a hard
 * timeout, a 429 or 503 waits as long as the server's Retry-After asks (capped), other 5xx
 * answers and network failures back off exponentially with jitter, and the caller's signal
 * stops it all. Vendor shapes stay in the client that uses it.
 */

export interface RestClientOptions {
  baseUrl: string;
  headers?: Readonly<Record<string, string>>;
  /** The fetch to send with; importers get one that enforces the address policy. */
  fetch?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
  /** Longest single wait, whatever Retry-After says. */
  maxDelayMs?: number;
  /** Largest response read, JSON or bytes. */
  maxBytes?: number;
  signal?: AbortSignal;
  /** Told about each wait, for logs and tests. */
  onRetry?: (info: {
    url: string;
    status: number | null;
    delayMs: number;
    attempt: number;
  }) => void;
  /** Replaced in tests so backoff does not slow them down. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

/** A list value repeats the parameter (keys=A&keys=B), as some APIs take several values. */
export type RestQuery = Readonly<
  Record<string, string | number | boolean | readonly string[] | undefined>
>;

export interface RestClient {
  getJson<T = unknown>(path: string, query?: RestQuery): Promise<T>;
  postJson<T = unknown>(path: string, body: unknown): Promise<T>;
  /** Any other method with a JSON body: PATCH, PUT, DELETE. */
  sendJson<T = unknown>(
    method: 'PATCH' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T>;
  /** Bytes from a path or an absolute URL on the same origin. */
  getBytes(pathOrUrl: string): Promise<{ bytes: Uint8Array; contentType: string }>;
}

const RETRY_STATUSES = new Set([429, 502, 503, 504]);
const DEFAULTS = { timeoutMs: 30_000, maxRetries: 6, maxDelayMs: 60_000, maxBytes: 25 << 20 };

export function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason as Error);
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason as Error);
      },
      { once: true },
    );
  });
}

/** Retry-After as seconds or an HTTP date, in milliseconds; null when absent or unreadable. */
export function retryAfterMs(header: string | null, now = Date.now()): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const at = Date.parse(header);
  return Number.isNaN(at) ? null : Math.max(0, at - now);
}

export function createRestClient(options: RestClientOptions): RestClient {
  const config = { ...DEFAULTS, ...options };
  const send = options.fetch ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const base = new URL(options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`);

  function urlFor(pathOrUrl: string, query?: RestQuery): URL {
    const url = /^https?:\/\//i.test(pathOrUrl)
      ? new URL(pathOrUrl)
      : new URL(pathOrUrl.replace(/^\//, ''), base);
    if (url.origin !== base.origin) throw new Error(`${url.origin} is not the source's address`);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        url.searchParams.delete(key);
        for (const item of value as readonly string[]) url.searchParams.append(key, item);
      } else url.searchParams.set(key, String(value));
    }
    return url;
  }

  async function request(url: URL, init: RequestInit): Promise<Response> {
    for (let attempt = 0; ; attempt += 1) {
      const signals = [AbortSignal.timeout(config.timeoutMs)];
      if (options.signal) signals.push(options.signal);
      let response: Response | null = null;
      let failure: unknown = null;
      try {
        response = await send(url, {
          ...init,
          headers: { ...options.headers, ...(init.headers as Record<string, string>) },
          signal: AbortSignal.any(signals),
        });
      } catch (error) {
        if (options.signal?.aborted) throw error;
        failure = error;
      }
      const retryable = response === null || RETRY_STATUSES.has(response.status);
      if (!retryable && response) return response;
      if (attempt >= config.maxRetries) {
        if (response) return response;
        throw failure instanceof Error ? failure : new Error(`${url.origin} did not answer`);
      }
      const asked = response ? retryAfterMs(response.headers.get('retry-after')) : null;
      const backoff = Math.min(config.maxDelayMs, 500 * 2 ** attempt) * (0.5 + Math.random() / 2);
      const delayMs = Math.min(config.maxDelayMs, asked ?? backoff);
      await response?.body?.cancel();
      options.onRetry?.({ url: url.href, status: response?.status ?? null, delayMs, attempt });
      await sleep(delayMs, options.signal);
    }
  }

  async function readText(url: URL, response: Response): Promise<string> {
    const length = Number(response.headers.get('content-length') ?? 0);
    if (length > config.maxBytes) throw new Error(`${url.href} is larger than allowed`);
    const text = await response.text();
    if (text.length > config.maxBytes) throw new Error(`${url.href} is larger than allowed`);
    if (!response.ok) throw new HttpStatusError(url.href, response.status, text.slice(0, 2_000));
    return text;
  }

  async function sendJson<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = urlFor(path);
    const response = await request(url, {
      method,
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await readText(url, response);
    return (text ? JSON.parse(text) : null) as T;
  }

  return {
    async getJson<T>(path: string, query?: RestQuery) {
      const url = urlFor(path, query);
      const response = await request(url, { headers: { accept: 'application/json' } });
      const text = await readText(url, response);
      return (text ? JSON.parse(text) : null) as T;
    },
    postJson: <T>(path: string, body: unknown) => sendJson<T>('POST', path, body),
    sendJson,
    async getBytes(pathOrUrl: string) {
      const url = urlFor(pathOrUrl);
      const response = await request(url, { headers: { accept: '*/*' } });
      if (!response.ok) {
        throw new HttpStatusError(url.href, response.status, (await response.text()).slice(0, 500));
      }
      const length = Number(response.headers.get('content-length') ?? 0);
      if (length > config.maxBytes) throw new Error(`${url.href} is larger than allowed`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > config.maxBytes) throw new Error(`${url.href} is larger than allowed`);
      return {
        bytes,
        contentType: response.headers.get('content-type') ?? 'application/octet-stream',
      };
    },
  };
}
