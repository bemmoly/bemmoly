import {
  ConflictError,
  ForbiddenError,
  isBemmolyError,
  NotFoundError,
  ProviderError,
  RateLimitedError,
  toValidationIssues,
  UnauthenticatedError,
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
];

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
  if (error instanceof RateLimitedError && error.retryAfterSeconds !== undefined) {
    headers['retry-after'] = String(error.retryAfterSeconds);
  }
  const body: ApiErrorBody = { code: error.code, message: error.message, requestId };
  if (error.details !== undefined) body.details = error.details;
  return { status, body, headers };
}

/** The one mapping from thrown errors to HTTP status codes and the error body. */
export function toHttpError(error: unknown, requestId: string): HttpError {
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
