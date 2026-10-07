import { describe, expect, it } from 'vitest';
import {
  ConflictError,
  ForbiddenError,
  isBemmolyError,
  NotFoundError,
  ProviderError,
  RateLimitedError,
  ValidationError,
} from './errors.ts';
import { errorCodeSchema } from './codes.ts';

describe('typed errors', () => {
  it.each([
    [new NotFoundError(), 'not_found', 'NotFoundError'],
    [new ForbiddenError(), 'forbidden', 'ForbiddenError'],
    [new ValidationError(), 'validation_failed', 'ValidationError'],
    [new ConflictError(), 'conflict', 'ConflictError'],
    [new RateLimitedError(), 'rate_limited', 'RateLimitedError'],
    [new ProviderError(), 'provider_error', 'ProviderError'],
  ])('%o carries its default code and name', (error, code, name) => {
    expect(error.code).toBe(code);
    expect(error.name).toBe(name);
    expect(error).toBeInstanceOf(Error);
    expect(isBemmolyError(error)).toBe(true);
    expect(errorCodeSchema.safeParse(error.code).success).toBe(true);
  });

  it('accepts a narrower code where the class allows one', () => {
    const error = new ForbiddenError('No access to work', { code: 'module_access_denied' });
    expect(error.code).toBe('module_access_denied');
    expect(new NotFoundError('off', { code: 'module_not_enabled' }).code).toBe(
      'module_not_enabled',
    );
  });

  it('keeps details, cause and extra fields', () => {
    const cause = new Error('socket hang up');
    const provider = new ProviderError('SMTP failed', {
      provider: 'smtp',
      cause,
      details: { attempt: 2 },
    });
    expect(provider.cause).toBe(cause);
    expect(provider.provider).toBe('smtp');
    expect(provider.details).toEqual({ attempt: 2 });
    expect(new RateLimitedError('slow down', { retryAfterSeconds: 30 }).retryAfterSeconds).toBe(30);
  });

  it('does not treat plain errors as typed errors', () => {
    expect(isBemmolyError(new Error('x'))).toBe(false);
    expect(isBemmolyError({ code: 'not_found' })).toBe(false);
  });
});
