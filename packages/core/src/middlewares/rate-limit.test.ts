import { describe, expect, it } from 'vitest';
import { parseEnv } from '../config/env.ts';
import { accountBucketKey, accountOfRoute } from './rate-limit-accounts.ts';
import { rateLimitBudgets } from './rate-limit.ts';

const required = {
  BEMMOLY_SECRET_KEY: Buffer.alloc(32, 1).toString('base64'),
  BEMMOLY_PUBLIC_URL: 'https://bemmoly.example.com',
};

describe('rate limit budgets', () => {
  it('defaults to the documented budgets', () => {
    expect(rateLimitBudgets(parseEnv(required))).toEqual({
      perActor: { max: 600, windowMs: 60_000 },
      strictPerIp: { max: 10, windowMs: 60_000 },
      perAccount: { max: 10, windowMs: 900_000 },
    });
  });

  it('lets the environment change a maximum but never the window or switch it off', () => {
    const env = parseEnv({ ...required, BEMMOLY_RATE_LIMIT_AUTH_PER_ACCOUNT: '25' });
    expect(rateLimitBudgets(env).perAccount).toEqual({ max: 25, windowMs: 900_000 });
    expect(() => parseEnv({ ...required, BEMMOLY_RATE_LIMIT_AUTH_PER_IP: '0' })).toThrow(
      /BEMMOLY_RATE_LIMIT_AUTH_PER_IP/,
    );
  });
});

describe('per-account keys', () => {
  const request = (body: unknown, params: unknown = {}) =>
    ({ body, params }) as Parameters<NonNullable<ReturnType<typeof accountOfRoute>>>[0];

  it('names the account by normalised email or by link token', () => {
    const login = accountOfRoute('POST', '/auth/login');
    expect(login?.(request({ email: ' Rohan@AcmeLabs.dev ' }))).toBe('rohan@acmelabs.dev');
    expect(login?.(request({ email: 7 }))).toBeUndefined();
    expect(login?.(request(undefined))).toBeUndefined();
    const accept = accountOfRoute('POST', '/auth/invitations/:token/accept');
    expect(accept?.(request({}, { token: 'abc' }))).toBe('abc');
    expect(accountOfRoute('GET', '/auth/invitations/:token')).toBeUndefined();
    expect(accountOfRoute('POST', '/setup/admin')).toBeUndefined();
  });

  it('stores a digest, scoped to the route', () => {
    const key = accountBucketKey('POST /api/v1/auth/login', 'rohan@acmelabs.dev');
    expect(key).toMatch(/^account\|POST \/api\/v1\/auth\/login\|[\w-]{43}$/);
    expect(key).not.toContain('rohan');
    expect(accountBucketKey('POST /api/v1/auth/password-reset', 'rohan@acmelabs.dev')).not.toBe(
      key,
    );
  });
});
