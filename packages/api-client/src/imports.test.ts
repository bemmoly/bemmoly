import { http as route, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApiClient, isApiError, queryKeys } from './index.ts';

const BASE = 'http://bemmoly.test';
const server = setupServer();
const absolute = (input: RequestInfo | URL, init?: RequestInit) =>
  fetch(new URL(String(input), BASE), init);
const ID = '018f0000-0000-7000-8000-0000000000a1';

const job = {
  id: ID,
  source: 'csv',
  sourceLabel: 'CSV file',
  status: 'ready',
  phase: null,
  progress: { done: 0, total: 0 },
  connection: { token: true },
  discovery: null,
  plan: null,
  report: { counts: {}, skipped: [], skippedTotal: 0, warnings: [] },
  error: null,
  runs: 0,
  createdAt: '2026-10-07T09:00:00Z',
  startedAt: null,
  finishedAt: null,
};

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('import endpoints', () => {
  it('creates a job with a validated body and parses the answer', async () => {
    const seen = vi.fn();
    server.use(
      route.post(`${BASE}/api/v1/admin/imports`, async ({ request }) => {
        seen(await request.json());
        return HttpResponse.json(job, { status: 201 });
      }),
    );
    const api = createApiClient({ fetch: absolute });
    const created = await api.imports.create({ source: 'csv', values: { file: 'a,b' } });
    expect(created.status).toBe('ready');
    expect(seen).toHaveBeenCalledWith({ source: 'csv', values: { file: 'a,b' } });
  });

  it('refuses an empty container list before it leaves the browser', async () => {
    const api = createApiClient({ fetch: absolute });
    const failure: unknown = await api.imports.update(ID, { containers: [] }).catch((e) => e);
    expect(isApiError(failure) && failure.code).toBe('validation_failed');
  });

  it('runs and cancels through their own paths', async () => {
    server.use(
      route.post(`${BASE}/api/v1/admin/imports/${ID}/run`, () =>
        HttpResponse.json({ ...job, status: 'queued' }),
      ),
      route.post(`${BASE}/api/v1/admin/imports/${ID}/cancel`, () =>
        HttpResponse.json({ ...job, status: 'cancelled' }),
      ),
    );
    const api = createApiClient({ fetch: absolute });
    expect((await api.imports.run(ID)).status).toBe('queued');
    expect((await api.imports.cancel(ID)).status).toBe('cancelled');
    expect(queryKeys.imports.detail(ID)[0]).toBe('imports');
  });
});
