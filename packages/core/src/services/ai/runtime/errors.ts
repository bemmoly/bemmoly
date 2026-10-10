import {
  ProviderError,
  type AiProviderErrorDetails,
  type AiProviderFailure,
} from '@bemmoly/shared';

/**
 * The SDK's API call errors, read by shape so this file needs no SDK import: a status code,
 * the response headers and a body or message from the provider.
 */
interface ApiCallShape {
  name?: string;
  message?: string;
  statusCode?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  isRetryable?: boolean;
  lastError?: unknown;
  cause?: unknown;
}

function failureOf(error: ApiCallShape): AiProviderFailure {
  const status = error.statusCode;
  if (error.name === 'AbortError' || error.name === 'TimeoutError') return 'timeout';
  if (status === 429) return 'rate_limit';
  if (status === 401 || status === 403) return 'auth';
  if (status === 404) return 'not_found';
  if (status !== undefined && status >= 500) return 'unavailable';
  if (status !== undefined && status >= 400) return 'bad_request';
  if (error.name === 'AI_LoadAPIKeyError' || error.name === 'AI_LoadSettingError') return 'auth';
  if (
    error.name === 'AI_NoObjectGeneratedError' ||
    error.name === 'AI_TypeValidationError' ||
    error.name === 'AI_JSONParseError' ||
    error.name === 'AI_NoOutputGeneratedError'
  ) {
    return 'invalid_output';
  }
  if (/ECONNREFUSED|ENOTFOUND|ECONNRESET|fetch failed|socket hang up/i.test(error.message ?? '')) {
    return 'unavailable';
  }
  return 'unknown';
}

function retryAfterOf(headers: Record<string, string> | undefined): number | null {
  const value = headers?.['retry-after'] ?? headers?.['Retry-After'];
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds));
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : Math.max(0, Math.round((at - Date.now()) / 1000));
}

/** The provider's own words, one line, without anything that looks like a key. */
function providerMessageOf(error: ApiCallShape): string | null {
  let text = error.message ?? '';
  if (error.responseBody) {
    try {
      const body = JSON.parse(error.responseBody) as { error?: { message?: string } | string };
      const inner = typeof body.error === 'string' ? body.error : body.error?.message;
      if (inner) text = inner;
    } catch {
      // A non-JSON body: the error's own message stands.
    }
  }
  const clean = text
    .replace(/\b(sk|key|token|bearer)[-_ ]?[A-Za-z0-9_-]{12,}/gi, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim();
  return clean ? clean.slice(0, 300) : null;
}

const COPY: Record<AiProviderFailure, (provider: string, retry: number | null) => string> = {
  rate_limit: (p, retry) =>
    retry === null
      ? `${p} returned a rate limit; try again in a moment`
      : `${p} returned a rate limit; I'll retry in ${retry} seconds`,
  auth: (p) => `${p} refused the credentials; check them in Settings › AI`,
  timeout: (p) => `${p} took too long to answer`,
  unavailable: (p) => `${p} could not be reached`,
  bad_request: (p) => `${p} rejected the request`,
  invalid_output: (p) => `${p} returned an answer that did not match the expected shape`,
  not_found: (p) => `${p} does not know this model; pick another in Settings › AI`,
  unknown: (p) => `${p} failed to answer`,
};

/** Unwraps the SDK's retry wrapper to the error that actually happened. */
function innermost(error: unknown): ApiCallShape {
  const shape = (error ?? {}) as ApiCallShape;
  if (shape.name === 'AI_RetryError' && shape.lastError) return innermost(shape.lastError);
  return shape;
}

/** Any failure from a model call as the typed ProviderError, with honest copy. */
export function toProviderError(error: unknown, provider: string): ProviderError {
  if (error instanceof ProviderError) return error;
  const shape = innermost(error);
  const failure = failureOf(shape);
  const retryAfterSeconds = failure === 'rate_limit' ? retryAfterOf(shape.responseHeaders) : null;
  const details: AiProviderErrorDetails = {
    failure,
    provider,
    providerMessage: providerMessageOf(shape),
    retryAfterSeconds,
  };
  return new ProviderError(COPY[failure](provider, retryAfterSeconds), {
    provider,
    details,
    cause: error,
  });
}

/** Whether another attempt could succeed: rate limits, timeouts and 5xx. */
export function isRetryable(error: unknown): boolean {
  const shape = innermost(error);
  if (shape.isRetryable !== undefined) return shape.isRetryable;
  const failure = failureOf(shape);
  return failure === 'rate_limit' || failure === 'unavailable' || failure === 'timeout';
}

export function isAbort(error: unknown, signal?: AbortSignal): boolean {
  return Boolean(signal?.aborted) || (error as { name?: string } | null)?.name === 'AbortError';
}
