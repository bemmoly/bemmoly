import { describe, expect, it, vi } from 'vitest';
import { HttpStatusError } from './http-json.ts';
import { createImportFetch } from './import-fetch.ts';
import { createRestClient, retryAfterMs } from './rest.ts';

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

describe('createRestClient', () => {
  it('waits as long as Retry-After asks on 429, then succeeds', async () => {
    const send = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({}, 429, { 'retry-after': '3' }))
      .mockResolvedValueOnce(json({ ok: true }));
    const sleep = vi.fn(async () => undefined);
    const client = createRestClient({ baseUrl: 'https://site.example.test', fetch: send, sleep });
    await expect(client.getJson('rest/thing', { a: 1 })).resolves.toEqual({ ok: true });
    expect(sleep).toHaveBeenCalledWith(3000, undefined);
    expect(String(send.mock.calls[0]![0])).toBe('https://site.example.test/rest/thing?a=1');
  });

  it('backs off on 503 and network failures, and gives up after the retries', async () => {
    const send = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('socket hang up'));
    const sleep = vi.fn(async () => undefined);
    const client = createRestClient({
      baseUrl: 'https://site.example.test',
      fetch: send,
      sleep,
      maxRetries: 2,
    });
    await expect(client.getJson('x')).rejects.toThrow('socket hang up');
    expect(send).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('throws HttpStatusError for other answers without retrying', async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(json({ message: 'no' }, 403));
    const client = createRestClient({ baseUrl: 'https://site.example.test', fetch: send });
    await expect(client.getJson('x')).rejects.toBeInstanceOf(HttpStatusError);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('refuses absolute URLs on another origin', async () => {
    const client = createRestClient({ baseUrl: 'https://site.example.test/jira', fetch: vi.fn() });
    await expect(client.getBytes('https://elsewhere.example.test/file')).rejects.toThrow(
      /not the source/,
    );
  });

  it('reads Retry-After as seconds or a date', () => {
    expect(retryAfterMs('2')).toBe(2000);
    expect(retryAfterMs(new Date(10_000).toUTCString(), 4_000)).toBe(6000);
    expect(retryAfterMs('soon')).toBeNull();
    expect(retryAfterMs(null)).toBeNull();
  });
});

describe('createImportFetch', () => {
  it('follows redirects and drops credentials on another origin', async () => {
    const seen: { url: string; auth: string | null }[] = [];
    const base = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      seen.push({ url, auth: new Headers(init?.headers).get('authorization') });
      if (url.endsWith('/content/1')) {
        return new Response(null, {
          status: 303,
          headers: { location: 'https://media.example.test/f/1' },
        });
      }
      return new Response('bytes');
    });
    const guarded = createImportFetch('any', base);
    const response = await guarded('https://site.example.test/content/1', {
      headers: { authorization: 'Basic abc' },
    });
    expect(await response.text()).toBe('bytes');
    expect(seen).toEqual([
      { url: 'https://site.example.test/content/1', auth: 'Basic abc' },
      { url: 'https://media.example.test/f/1', auth: null },
    ]);
  });

  it('stops after three redirects', async () => {
    const base = vi.fn<typeof fetch>(
      async () => new Response(null, { status: 302, headers: { location: '/again' } }),
    );
    await expect(createImportFetch('any', base)('https://site.example.test/a')).rejects.toThrow(
      /too many/,
    );
  });

  it('checks every hop against the address policy', async () => {
    const base = vi.fn<typeof fetch>(
      async () =>
        new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } }),
    );
    await expect(createImportFetch('local', base)('http://127.0.0.1:9/a')).rejects.toThrow(
      /link-local/,
    );
  });
});
