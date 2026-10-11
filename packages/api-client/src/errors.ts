import { apiErrorBodySchema, type ErrorCode } from '@bemmoly/shared';

/**
 * Codes outside the shared enum: no server, an unexpected body, a failure in the browser
 * before the request left, and the operations stream's 503 while a restore, update or
 * rollback runs.
 */
export type ClientErrorCode = 'network_error' | 'invalid_response' | 'client_error' | 'maintenance';

export type ApiErrorCode = ErrorCode | ClientErrorCode;

const CODE_BY_STATUS: Readonly<Record<number, ErrorCode>> = {
  400: 'bad_request',
  401: 'unauthenticated',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  413: 'payload_too_large',
  429: 'rate_limited',
  502: 'provider_error',
};

/**
 * Every failed call surfaces as one error type carrying the shared error body,
 * so screens map `code` to copy and show `requestId` for support.
 */
export class ApiError extends Error {
  override readonly name = 'ApiError';
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details: unknown;
  readonly requestId: string | undefined;
  /** Seconds to wait before trying again, from Retry-After on a 429 or 503. */
  readonly retryAfterSeconds: number | undefined;

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    options: {
      details?: unknown;
      requestId?: string | undefined;
      cause?: unknown;
      retryAfterSeconds?: number | undefined;
    } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.status = status;
    this.code = code;
    this.details = options.details;
    this.requestId = options.requestId;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

export function hasErrorCode(value: unknown, code: ApiErrorCode): boolean {
  return isApiError(value) && value.code === code;
}

/** Retry-After in whole seconds (a number or an HTTP date); undefined when absent or unreadable. */
export function retryAfterOf(header: string | null, now = Date.now()): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const at = Date.parse(header);
  return Number.isNaN(at) ? undefined : Math.max(0, Math.ceil((at - now) / 1000));
}

/** Builds the error for a non-2xx response, preferring the server's own body. */
export function errorFromResponse(response: Response, body: unknown): ApiError {
  const headerId = response.headers.get('x-request-id') ?? undefined;
  const retryAfterSeconds = retryAfterOf(response.headers.get('retry-after'));
  const loose = body as { code?: unknown; message?: unknown; requestId?: unknown } | undefined;
  if (response.status === 503 && loose?.code === 'maintenance') {
    const message =
      typeof loose.message === 'string' ? loose.message : 'Bemmoly is in maintenance.';
    const requestId = typeof loose.requestId === 'string' ? loose.requestId : headerId;
    return new ApiError(503, 'maintenance', message, {
      details: body,
      requestId,
      retryAfterSeconds,
    });
  }
  const parsed = apiErrorBodySchema.safeParse(body);
  if (parsed.success) {
    return new ApiError(response.status, parsed.data.code, parsed.data.message, {
      details: parsed.data.details,
      requestId: parsed.data.requestId,
      retryAfterSeconds,
    });
  }
  const code = CODE_BY_STATUS[response.status] ?? 'internal_error';
  return new ApiError(response.status, code, `The server answered ${response.status}.`, {
    requestId: headerId,
    retryAfterSeconds,
  });
}

/** Field messages from a `validation_failed` body, keyed by dotted path. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!isApiError(error) || error.code !== 'validation_failed') return {};
  const details = error.details as { issues?: Array<{ path?: unknown; message?: unknown }> };
  const result: Record<string, string> = {};
  for (const issue of details?.issues ?? []) {
    if (typeof issue.path === 'string' && typeof issue.message === 'string') {
      result[issue.path] ??= issue.message;
    }
  }
  return result;
}
