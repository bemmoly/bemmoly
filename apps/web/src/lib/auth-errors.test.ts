import { ApiError } from '@bemmoly/api-client';
import { describe, expect, it } from 'vitest';
import { clock, isServerDown, signInFailure } from './auth-errors.ts';

const error = (status: number, code: string, message = '', options = {}) =>
  new ApiError(status, code as never, message, options);

describe('signInFailure', () => {
  it('tells the failures the sign-in page treats differently apart', () => {
    expect(signInFailure(error(401, 'unauthenticated', 'Email or password is incorrect'))).toEqual({
      kind: 'wrong-password',
    });
    expect(
      signInFailure(error(401, 'unauthenticated', 'x', { details: { reason: 'deactivated' } })),
    ).toEqual({ kind: 'deactivated' });
    expect(
      signInFailure(error(403, 'forbidden', 'x', { details: { reason: 'sso_required' } })),
    ).toEqual({ kind: 'sso-required' });
    expect(signInFailure(error(0, 'network_error'))).toEqual({ kind: 'server-down' });
    expect(signInFailure(error(503, 'internal_error'))).toEqual({ kind: 'server-down' });
    expect(signInFailure(new DOMException('slow', 'TimeoutError'))).toEqual({ kind: 'timeout' });
  });

  it('takes the wait from Retry-After, then the body, then a minute', () => {
    expect(signInFailure(error(429, 'rate_limited', '', { retryAfterSeconds: 42 }))).toEqual({
      kind: 'rate-limited',
      retryAfterSeconds: 42,
    });
    expect(
      signInFailure(error(429, 'rate_limited', '', { details: { retryAfterSeconds: 9 } })),
    ).toEqual({ kind: 'rate-limited', retryAfterSeconds: 9 });
    expect(signInFailure(error(429, 'rate_limited'))).toEqual({
      kind: 'rate-limited',
      retryAfterSeconds: 60,
    });
  });

  it('shows a request id only for failures on the server’s side', () => {
    expect(signInFailure(error(500, 'internal_error', 'Boom', { requestId: 'r1' }))).toEqual({
      kind: 'other',
      message: 'Boom',
      requestId: 'r1',
    });
    expect(signInFailure(error(400, 'bad_request', 'Nope', { requestId: 'r2' }))).toEqual({
      kind: 'other',
      message: 'Nope',
      requestId: undefined,
    });
  });

  it('counts down as minutes and seconds', () => {
    expect(clock(42)).toBe('0:42');
    expect(clock(61.2)).toBe('1:02');
    expect(clock(-3)).toBe('0:00');
    expect(isServerDown(new Error('x'))).toBe(false);
  });
});
