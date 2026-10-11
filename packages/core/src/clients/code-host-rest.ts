import type { AddressPolicy } from './guarded-fetch.ts';
import { createImportFetch } from './import-fetch.ts';
import { createRestClient, type RestClient, type RestClientOptions } from './rest.ts';

/*
 * The REST client a code host's API is called through: the shared client's hard timeout and
 * Retry-After backoff, every hop checked against the address policy, and the one rate-limit
 * answer the shared client cannot read on its own: a 403 that says the hourly budget is
 * spent (x-ratelimit-remaining: 0), which is turned into a 429 that waits for the reset.
 */

export interface CodeHostRestOptions {
  baseUrl: string;
  headers: Readonly<Record<string, string>>;
  policy: AddressPolicy;
  signal?: AbortSignal;
  /** Tests hand a fake; production sends with the guarded fetch. */
  fetch?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
  sleep?: RestClientOptions['sleep'];
}

/** A request answered by the API, for the backfill and the connection test. */
export const CODE_HOST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 4;
/** One wait for the hourly reset is worth it in a backfill job; longer is a failed run. */
const MAX_DELAY_MS = 5 * 60_000;

/** A 403 that means "rate limited", answered as the 429 the shared client backs off from. */
export function withRateLimitAsRetry(send: typeof fetch, now = () => Date.now()): typeof fetch {
  return async (input, init) => {
    const response = await send(input, init);
    if (response.status !== 403) return response;
    const remaining = response.headers.get('x-ratelimit-remaining');
    const retryAfter = response.headers.get('retry-after');
    if (remaining !== '0' && retryAfter === null) return response;
    const reset = Number(response.headers.get('x-ratelimit-reset'));
    const waitSeconds =
      retryAfter ?? String(Number.isFinite(reset) ? Math.max(1, reset - now() / 1000) : 60);
    await response.body?.cancel();
    return new Response(null, {
      status: 429,
      headers: { 'retry-after': String(Math.ceil(Number(waitSeconds))) },
    });
  };
}

export function createCodeHostRest(options: CodeHostRestOptions): RestClient {
  const guarded = createImportFetch(options.policy, options.fetch ?? fetch);
  return createRestClient({
    baseUrl: options.baseUrl,
    headers: options.headers,
    fetch: withRateLimitAsRetry(guarded),
    timeoutMs: options.timeoutMs ?? CODE_HOST_TIMEOUT_MS,
    maxRetries: options.maxRetries ?? MAX_RETRIES,
    maxDelayMs: MAX_DELAY_MS,
    maxBytes: 8 << 20,
    ...(options.signal ? { signal: options.signal } : {}),
    ...(options.sleep ? { sleep: options.sleep } : {}),
  });
}
