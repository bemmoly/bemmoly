import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ProviderError,
  UnauthenticatedError,
  ValidationError,
} from '@bemmoly/shared';
import type { z } from 'zod';
import type { Logger } from '../config/logger.ts';
import { backoffMs, sleep } from '../utils/time.ts';

const PROVIDER = 'control-plane';

/** A raw request body: what fetch accepts, named without the DOM library. */
export type RawBody = NonNullable<RequestInit['body']>;

/** Opens a raw body afresh for each try, so a retry can read a file again. */
export type OpenRawBody = () => { body: RawBody; length: number };

export interface RetryPolicy {
  /** Tries in total, the first included. */
  attempts: number;
  baseMs: number;
  maxMs: number;
}

export const DEFAULT_RETRY: RetryPolicy = { attempts: 5, baseMs: 500, maxMs: 15_000 };

export interface HttpRequest<T> {
  method: 'GET' | 'POST' | 'PUT';
  url: string;
  headers: Record<string, string>;
  /** A JSON value, or a factory for a raw body so a retry can read the file again. */
  json?: unknown;
  raw?: OpenRawBody;
  timeoutMs: number;
  /** Status codes that mean success; the first one with a schema parses the body. */
  ok: readonly number[];
  schema?: z.ZodType<T>;
  /** Which token the call carried, so a 401 says what was lost. */
  scope: 'runner' | 'job' | 'pool';
  signal?: AbortSignal;
  retry?: RetryPolicy;
}

export interface HttpResult<T> {
  status: number;
  data: T | undefined;
}

/** A failure worth another try: the network, a timeout, a 5xx or a 429. */
class RetryableError extends Error {
  override readonly name = 'RetryableError';
}

function errorFor(status: number, body: string, scope: string): Error {
  let message = `The control plane answered ${status}`;
  let code: string | undefined;
  try {
    const parsed = JSON.parse(body) as { code?: unknown; message?: unknown };
    if (typeof parsed.message === 'string') message = parsed.message;
    if (typeof parsed.code === 'string') code = parsed.code;
  } catch {
    // Not JSON (a proxy's error page): the status says enough.
  }
  const details = { status, code, scope };
  if (status === 401) return new UnauthenticatedError(message, { details });
  if (status === 403) return new ForbiddenError(message, { details });
  if (status === 404) return new NotFoundError(message, { details });
  if (status === 409) return new ConflictError(message, { details });
  if (status === 400 || status === 422) return new ValidationError(message, { details });
  return new ProviderError(message, { provider: PROVIDER, details });
}

async function attempt<T>(request: HttpRequest<T>): Promise<HttpResult<T>> {
  const timeout = AbortSignal.timeout(request.timeoutMs);
  const signal = request.signal ? AbortSignal.any([timeout, request.signal]) : timeout;
  const headers: Record<string, string> = { ...request.headers };
  let body: RawBody | undefined;
  if (request.raw) {
    const raw = request.raw();
    body = raw.body;
    headers['content-type'] = 'application/octet-stream';
    headers['content-length'] = String(raw.length);
  } else if (request.json !== undefined) {
    body = JSON.stringify(request.json);
    headers['content-type'] = 'application/json';
  }
  let response: Response;
  try {
    response = await fetch(request.url, {
      method: request.method,
      headers,
      body,
      signal,
      ...(request.raw ? { duplex: 'half' } : {}),
    } as RequestInit);
  } catch (error) {
    if (request.signal?.aborted) throw error;
    throw new RetryableError(`Could not reach the control plane: ${(error as Error).message}`, {
      cause: error,
    });
  }
  const text = await response.text().catch(() => '');
  if (response.status >= 500 || response.status === 429) {
    throw new RetryableError(`The control plane answered ${response.status}`);
  }
  if (!request.ok.includes(response.status)) throw errorFor(response.status, text, request.scope);
  if (!request.schema || text.length === 0) return { status: response.status, data: undefined };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new ProviderError('The control plane sent a body that is not JSON', {
      provider: PROVIDER,
      cause: error,
    });
  }
  const parsed = request.schema.safeParse(json);
  if (!parsed.success) {
    throw new ProviderError('The control plane sent an answer this runner does not understand', {
      provider: PROVIDER,
      details: parsed.error.issues,
    });
  }
  return { status: response.status, data: parsed.data };
}

/**
 * One request with bounded retries. Only the network, timeouts, 5xx and 429 are retried; a 4xx
 * is an answer and is thrown at once as a typed error.
 */
export async function sendWithRetry<T>(
  request: HttpRequest<T>,
  logger: Logger,
): Promise<HttpResult<T>> {
  const policy = request.retry ?? DEFAULT_RETRY;
  for (let tries = 1; ; tries++) {
    try {
      return await attempt(request);
    } catch (error) {
      if (!(error instanceof RetryableError) || request.signal?.aborted) throw error;
      if (tries >= policy.attempts) {
        throw new ProviderError(error.message, { provider: PROVIDER, cause: error });
      }
      const wait = backoffMs(tries - 1, policy.baseMs, policy.maxMs);
      logger.debug({ url: request.url, tries, wait, err: error.message }, 'retrying');
      await sleep(wait, request.signal);
    }
  }
}

export function isUnauthenticated(error: unknown, scope?: 'runner' | 'job' | 'pool'): boolean {
  if (!(error instanceof UnauthenticatedError)) return false;
  const details = error.details as { scope?: string } | undefined;
  return scope === undefined || details?.scope === scope;
}
