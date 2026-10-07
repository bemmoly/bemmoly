import type { ErrorCode } from './codes.ts';

export interface BemmolyErrorOptions<C extends ErrorCode> {
  code?: C;
  details?: unknown;
  cause?: unknown;
}

/**
 * Base for every error a service may throw. The HTTP error handler maps the
 * concrete subclass to a status code; services and controllers never pick one.
 */
export abstract class BemmolyError<C extends ErrorCode = ErrorCode> extends Error {
  readonly code: C;
  readonly details: unknown;

  protected constructor(message: string, code: C, options: BemmolyErrorOptions<C> = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.code = options.code ?? code;
    this.details = options.details;
  }
}

/** No valid session or token was presented; the client should sign in. */
export class UnauthenticatedError extends BemmolyError<'unauthenticated'> {
  override readonly name = 'UnauthenticatedError';

  constructor(message = 'Sign in to continue', options?: BemmolyErrorOptions<'unauthenticated'>) {
    super(message, 'unauthenticated', options);
  }
}

export class NotFoundError extends BemmolyError<'not_found' | 'module_not_enabled'> {
  override readonly name = 'NotFoundError';

  constructor(
    message = 'The resource was not found',
    options?: BemmolyErrorOptions<'not_found' | 'module_not_enabled'>,
  ) {
    super(message, 'not_found', options);
  }
}

export class ForbiddenError extends BemmolyError<'forbidden' | 'module_access_denied'> {
  override readonly name = 'ForbiddenError';

  constructor(
    message = 'You do not have access to this resource',
    options?: BemmolyErrorOptions<'forbidden' | 'module_access_denied'>,
  ) {
    super(message, 'forbidden', options);
  }
}

export class ValidationError extends BemmolyError<'validation_failed' | 'bad_request'> {
  override readonly name = 'ValidationError';

  constructor(
    message = 'The request is not valid',
    options?: BemmolyErrorOptions<'validation_failed' | 'bad_request'>,
  ) {
    super(message, 'validation_failed', options);
  }
}

export class ConflictError extends BemmolyError<'conflict'> {
  override readonly name = 'ConflictError';

  constructor(
    message = 'The resource changed or already exists',
    options?: BemmolyErrorOptions<'conflict'>,
  ) {
    super(message, 'conflict', options);
  }
}

export interface RateLimitedErrorOptions extends BemmolyErrorOptions<'rate_limited'> {
  retryAfterSeconds?: number;
}

export class RateLimitedError extends BemmolyError<'rate_limited'> {
  override readonly name = 'RateLimitedError';
  readonly retryAfterSeconds: number | undefined;

  constructor(message = 'Too many requests', options: RateLimitedErrorOptions = {}) {
    super(message, 'rate_limited', options);
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export interface ProviderErrorOptions extends BemmolyErrorOptions<'provider_error'> {
  provider?: string;
}

/** An external system (SMTP relay, object store, AI provider) failed or timed out. */
export class ProviderError extends BemmolyError<'provider_error'> {
  override readonly name = 'ProviderError';
  readonly provider: string | undefined;

  constructor(message = 'An external provider failed', options: ProviderErrorOptions = {}) {
    super(message, 'provider_error', options);
    this.provider = options.provider;
  }
}

export function isBemmolyError(value: unknown): value is BemmolyError {
  return value instanceof BemmolyError;
}
