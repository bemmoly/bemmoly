import { http as route, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApiClient } from './index.ts';

const BASE = 'http://bemmoly.test';
const server = setupServer();
const absolute = (input: RequestInfo | URL, init?: RequestInit) =>
  fetch(new URL(String(input), BASE), init);
const KEY = `/api/v1/workspace/logo/${'a'.repeat(64)}.png`;

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('workspace logo', () => {
  it('sends the bytes raw and reads back where the logo is served', async () => {
    let size = 0;
    server.use(
      route.post(`${BASE}/api/v1/workspace/logo`, async ({ request }) => {
        size = (await request.arrayBuffer()).byteLength;
        return HttpResponse.json(
          { logoKey: KEY, mime: 'image/png', size, width: 256, height: 256 },
          { status: 201 },
        );
      }),
      route.delete(`${BASE}/api/v1/workspace/logo`, () => new HttpResponse(null, { status: 204 })),
    );
    const api = createApiClient({ fetch: absolute });
    const logo = await api.appearance.logo.upload(new Blob([new Uint8Array(5)]));
    expect(logo).toMatchObject({ logoKey: KEY, width: 256 });
    expect(size).toBe(5);
    await expect(api.appearance.logo.remove()).resolves.toBeUndefined();
  });
});
