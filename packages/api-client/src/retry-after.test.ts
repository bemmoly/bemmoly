import { describe, expect, it } from 'vitest';
import { errorFromResponse, retryAfterOf } from './errors.ts';

describe('Retry-After on ApiError', () => {
  it('reads seconds and HTTP dates', () => {
    expect(retryAfterOf('42')).toBe(42);
    expect(retryAfterOf(null)).toBeUndefined();
    expect(retryAfterOf('soon')).toBeUndefined();
    const now = Date.parse('2026-10-11T10:00:00Z');
    expect(retryAfterOf('Sun, 11 Oct 2026 10:00:30 GMT', now)).toBe(30);
  });

  it('carries the wait on a 429', () => {
    const response = new Response(null, { status: 429, headers: { 'retry-after': '17' } });
    const error = errorFromResponse(response, {
      code: 'rate_limited',
      message: 'Too many sign-in attempts. Try again in 17 seconds.',
      requestId: 'req-1',
    });
    expect(error.code).toBe('rate_limited');
    expect(error.retryAfterSeconds).toBe(17);
  });
});
