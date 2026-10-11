import { http as route, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApiClient, isApiError } from './index.ts';

const BASE = 'http://bemmoly.test';
const server = setupServer();
const absolute = (input: RequestInfo | URL, init?: RequestInit) =>
  fetch(new URL(String(input), BASE), init);
const PAGE = '018f0000-0000-7000-8000-0000000000a1';
const FILE = '018f0000-0000-7000-8000-0000000000f1';

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('files', () => {
  it('sends the bytes raw, naming the target in the query', async () => {
    let seen: { query: string; type: string | null; size: number } | undefined;
    server.use(
      route.post(`${BASE}/api/v1/files`, async ({ request }) => {
        seen = {
          query: new URL(request.url).search,
          type: request.headers.get('content-type'),
          size: (await request.arrayBuffer()).byteLength,
        };
        return HttpResponse.json(
          { id: FILE, url: `/api/v1/files/${FILE}`, name: 'a.png', mime: 'image/png', size: 3 },
          { status: 201 },
        );
      }),
    );
    const api = createApiClient({ fetch: absolute });
    const file = await api.files.upload(new Blob([new Uint8Array([1, 2, 3])]), {
      target: 'docs.page',
      targetId: PAGE,
      name: 'a.png',
    });
    expect(file.url).toBe(`/api/v1/files/${FILE}`);
    expect(seen).toEqual({
      query: `?target=docs.page&targetId=${PAGE}&name=a.png`,
      type: 'application/octet-stream',
      size: 3,
    });
  });

  it('surfaces a refusal as an ApiError with its details', async () => {
    server.use(
      route.post(`${BASE}/api/v1/files`, () =>
        HttpResponse.json(
          {
            code: 'validation_failed',
            message: 'SVG images are not accepted; export it as PNG instead',
            details: { reason: 'svg_refused' },
            requestId: 'r1',
          },
          { status: 400 },
        ),
      ),
    );
    const api = createApiClient({ fetch: absolute });
    const error = await api.files
      .upload(new Blob(['<svg/>']), { target: 'docs.page', targetId: PAGE })
      .catch((caught: unknown) => caught);
    expect(isApiError(error) && error.details).toEqual({ reason: 'svg_refused' });
  });
});
