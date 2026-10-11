import {
  ConflictError,
  ForbiddenError,
  isBemmolyError,
  MaintenanceError,
  NotFoundError,
  ProviderError,
  RateLimitedError,
  toValidationIssues,
  UnauthenticatedError,
  UnavailableError,
  ValidationError,
  type ApiErrorBody,
  type ErrorCode,
  type BemmolyError,
} from '@bemmoly/shared';
import { ZodError } from 'zod';

export interface HttpError {
  status: number;
  body: ApiErrorBody;
  headers: Record<string, string>;
}

const STATUS_BY_ERROR: ReadonlyArray<[abstract new (...args: never[]) => BemmolyError, number]> = [
  [UnauthenticatedError, 401],
  [NotFoundError, 404],
  [ForbiddenError, 403],
  [ValidationError, 400],
  [ConflictError, 409],
  [RateLimitedError, 429],
  [ProviderError, 502],
  [MaintenanceError, 503],
  [UnavailableError, 503],
];

/** Postgres ended a statement or a session on one of its timeouts: busy, not broken. */
const DATABASE_TIMEOUT_CODES = new Set(['57014', '25P03', '57P05']);
/** What the driver reports when Postgres ended the session under it, idle timeout included. */
const CONNECTION_LOST = 'CONNECTION_CLOSED';
const DATABASE_RETRY_AFTER_SECONDS = 5;
const MAX_CAUSE_DEPTH = 5;

/**
 * A starved pool or a database timeout, however deeply the ORM wrapped it: the request
 * fails with a typed 503 the client can retry, not an internal error.
 */
function unavailableCause(error: unknown): UnavailableError | undefined {
  let current: unknown = error;
  for (let depth = 0; current && depth < MAX_CAUSE_DEPTH; depth += 1) {
    if (current instanceof UnavailableError) return current;
    const { name, code, cause } = current as { name?: unknown; code?: unknown; cause?: unknown };
    const timedOut =
      (name === 'PostgresError' && typeof code === 'string' && DATABASE_TIMEOUT_CODES.has(code)) ||
      code === CONNECTION_LOST;
    if (timedOut) {
      return new UnavailableError(undefined, {
        retryAfterSeconds: DATABASE_RETRY_AFTER_SECONDS,
        details: { reason: 'database_timeout' },
        cause: current,
      });
    }
    current = cause;
  }
  return undefined;
}

const CLIENT_ERROR_CODES: Readonly<Record<number, ErrorCode>> = {
  401: 'unauthenticated',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  413: 'payload_too_large',
  429: 'rate_limited',
};

export const INTERNAL_ERROR_MESSAGE =
  'Something went wrong on our side. Quote the request id when you report it.';

interface FrameworkError {
  statusCode?: number;
  validation?: unknown;
  message: string;
}

function fromBemmolyError(error: BemmolyError, requestId: string): HttpError {
  const status = STATUS_BY_ERROR.find(([type]) => error instanceof type)?.[1] ?? 500;
  const headers: Record<string, string> = {};
  if (
    (error instanceof RateLimitedError ||
      error instanceof MaintenanceError ||
      error instanceof UnavailableError) &&
    error.retryAfterSeconds !== undefined
  ) {
    headers['retry-after'] = String(error.retryAfterSeconds);
  }
  const body: ApiErrorBody = { code: error.code, message: error.message, requestId };
  if (error.details !== undefined) body.details = error.details;
  return { status, body, headers };
}

/** The one mapping from thrown errors to HTTP status codes and the error body. */
export function toHttpError(error: unknown, requestId: string): HttpError {
  const unavailable = unavailableCause(error);
  if (unavailable) return fromBemmolyError(unavailable, requestId);
  if (isBemmolyError(error)) return fromBemmolyError(error, requestId);
  if (error instanceof ZodError) {
    const body = {
      code: 'validation_failed' as const,
      message: 'The request is not valid',
      details: { issues: toValidationIssues(error) },
      requestId,
    };
    return { status: 400, body, headers: {} };
  }
  // Anything can be thrown, including null; non-objects fall through to internal_error.
  const framework: Partial<FrameworkError> =
    typeof error === 'object' && error !== null ? (error as FrameworkError) : {};
  if (framework.validation !== undefined) {
    const body = {
      code: 'validation_failed' as const,
      message: framework.message ?? 'The request is not valid',
      details: framework.validation,
      requestId,
    };
    return { status: 400, body, headers: {} };
  }
  const status = framework.statusCode;
  if (status !== undefined && status >= 400 && status < 500) {
    const code = CLIENT_ERROR_CODES[status] ?? 'bad_request';
    const message = framework.message ?? 'The request could not be handled';
    return { status, body: { code, message, requestId }, headers: {} };
  }
  return {
    status: 500,
    body: { code: 'internal_error', message: INTERNAL_ERROR_MESSAGE, requestId },
    headers: {},
  };
}
