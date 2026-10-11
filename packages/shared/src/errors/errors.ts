import type { ErrorCode } from './codes.ts';

/** Values for a message's placeholders: "{count, plural, …}" takes count. */
export type MessageValues = Record<string, string | number>;

export interface BemmolyErrorOptions<C extends ErrorCode> {
  code?: C;
  details?: unknown;
  cause?: unknown;
  /**
   * The catalog id the message renders, so a client can show it in the person's language
   * (ADR 0024). A custom message without one is shown as written.
   */
  messageId?: string;
  values?: MessageValues;
}

/**
 * Base for every error a service may throw. The HTTP error handler maps the
 * concrete subclass to a status code; services and controllers never pick one.
 */
export abstract class BemmolyError<C extends ErrorCode = ErrorCode> extends Error {
  readonly code: C;
  readonly details: unknown;
  /** The default message is `errors.<code>` in packages/shared/src/i18n/errors.en.json. */
  readonly messageId: string | undefined;
  readonly values: MessageValues | undefined;

  protected constructor(
    message: string | undefined,
    fallback: string,
    code: C,
    options: BemmolyErrorOptions<C> = {},
  ) {
    super(message ?? fallback, options.cause === undefined ? undefined : { cause: options.cause });
    this.code = options.code ?? code;
    this.details = options.details;
    this.messageId = options.messageId ?? (message === undefined ? `errors.${code}` : undefined);
    this.values = options.values;
  }
}

/** No credentials, or credentials that do not identify anyone (session, API token, scrape token). */
export class UnauthenticatedError extends BemmolyError<'unauthenticated'> {
  override readonly name = 'UnauthenticatedError';

  constructor(message?: string, options?: BemmolyErrorOptions<'unauthenticated'>) {
    super(message, 'Sign in to continue', 'unauthenticated', options);
  }
}

export class NotFoundError extends BemmolyError<'not_found' | 'module_not_enabled'> {
  override readonly name = 'NotFoundError';

  constructor(message?: string, options?: BemmolyErrorOptions<'not_found' | 'module_not_enabled'>) {
    super(message, 'The resource was not found', 'not_found', options);
  }
}

export class ForbiddenError extends BemmolyError<'forbidden' | 'module_access_denied'> {
  override readonly name = 'ForbiddenError';

  constructor(
    message?: string,
    options?: BemmolyErrorOptions<'forbidden' | 'module_access_denied'>,
  ) {
    super(message, 'You do not have access to this resource', 'forbidden', options);
  }
}

export class ValidationError extends BemmolyError<'validation_failed' | 'bad_request'> {
  override readonly name = 'ValidationError';

  constructor(
    message?: string,
    options?: BemmolyErrorOptions<'validation_failed' | 'bad_request'>,
  ) {
    super(message, 'The request is not valid', 'validation_failed', options);
  }
}

export class ConflictError extends BemmolyError<'conflict'> {
  override readonly name = 'ConflictError';

  constructor(message?: string, options?: BemmolyErrorOptions<'conflict'>) {
    super(message, 'The resource changed or already exists', 'conflict', options);
  }
}

export interface RateLimitedErrorOptions extends BemmolyErrorOptions<'rate_limited'> {
  retryAfterSeconds?: number;
}

export class RateLimitedError extends BemmolyError<'rate_limited'> {
  override readonly name = 'RateLimitedError';
  readonly retryAfterSeconds: number | undefined;

  constructor(message?: string, options: RateLimitedErrorOptions = {}) {
    super(message, 'Too many requests', 'rate_limited', options);
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export interface MaintenanceErrorOptions extends BemmolyErrorOptions<'maintenance'> {
  retryAfterSeconds?: number;
}

/** A restore, update or rollback is running; writes wait until it ends. Mapped to 503. */
export class MaintenanceError extends BemmolyError<'maintenance'> {
  override readonly name = 'MaintenanceError';
  readonly retryAfterSeconds: number | undefined;

  constructor(message?: string, options: MaintenanceErrorOptions = {}) {
    super(message, 'Bemmoly is under maintenance', 'maintenance', options);
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

  constructor(message?: string, options: ProviderErrorOptions = {}) {
    super(message, 'An external provider failed', 'provider_error', options);
    this.provider = options.provider;
  }
}

export function isBemmolyError(value: unknown): value is BemmolyError {
  return value instanceof BemmolyError;
}
