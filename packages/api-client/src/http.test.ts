import { afterEach, describe, expect, it, vi } from 'vitest';
import { isApiError } from './errors.ts';
import { createHttp, randomKey } from './http.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const real = globalThis.crypto;

describe('http', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('makes a v4 key without crypto.randomUUID, as on plain HTTP over a LAN address', () => {
    vi.stubGlobal('crypto', { getRandomValues: real.getRandomValues.bind(real) });
    expect(randomKey()).toMatch(UUID);
  });

  it('turns a browser failure before the request leaves into a plain-words ApiError', async () => {
    vi.stubGlobal('crypto', {
      getRandomValues: () => {
        throw new TypeError('getRandomValues is not a function');
      },
    });
    const http = createHttp({ fetch: () => Promise.resolve(new Response(null, { status: 204 })) });
    const error: unknown = await http
      .send('/api/v1/things', { method: 'POST', idempotent: true })
      .catch((caught: unknown) => caught);
    expect(isApiError(error) && error.code).toBe('client_error');
    expect(isApiError(error) && error.message).not.toContain('function');
  });
});
