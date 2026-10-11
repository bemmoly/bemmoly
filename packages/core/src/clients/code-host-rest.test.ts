import { describe, expect, it } from 'vitest';
import { createCodeHostRest, withRateLimitAsRetry } from './code-host-rest.ts';

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

describe('code host rate limits', () => {
  it('turns a spent hourly budget into a wait until the reset', async () => {
    const send = withRateLimitAsRetry(
      async () => json(403, {}, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1030' }),
      () => 1_000_000,
    );
    const response = await send('https://api.example.test/user');
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('30');
  });

  it("keeps a secondary limit's Retry-After", async () => {
    const send = withRateLimitAsRetry(async () => json(403, {}, { 'retry-after': '7' }));
    const response = await send('https://api.example.test/user');
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('7');
  });

  it('leaves a plain refusal alone', async () => {
    const send = withRateLimitAsRetry(async () =>
      json(403, { message: 'Resource not accessible' }, { 'x-ratelimit-remaining': '4999' }),
    );
    expect((await send('https://api.example.test/user')).status).toBe(403);
  });

  it('backs off and retries until the host answers', async () => {
    const answers = [
      json(403, {}, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '0' }),
      json(503, {}),
      json(200, { login: 'bemmoly-bot' }),
    ];
    const waits: number[] = [];
    const rest = createCodeHostRest({
      baseUrl: 'https://api.example.test',
      headers: {},
      policy: 'any',
      fetch: async () => answers.shift()!,
      sleep: async (ms) => {
        waits.push(ms);
      },
    });
    expect(await rest.getJson('user')).toEqual({ login: 'bemmoly-bot' });
    expect(waits).toHaveLength(2);
  });

  it('gives up after its retries with the last answer', async () => {
    const rest = createCodeHostRest({
      baseUrl: 'https://api.example.test',
      headers: {},
      policy: 'any',
      maxRetries: 1,
      fetch: async () => json(502, { message: 'Bad gateway' }),
      sleep: async () => undefined,
    });
    await expect(rest.getJson('user')).rejects.toThrow(/answered 502/);
  });
});
