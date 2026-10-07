import { http as route, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApiClient, fieldErrors, isApiError, keysForEvent, queryKeys } from './index.ts';

const BASE = 'http://bemmoly.test';
const server = setupServer();
const absolute = (input: RequestInfo | URL, init?: RequestInit) =>
  fetch(new URL(String(input), BASE), init);
const ROLE = '018f0000-0000-7000-8000-000000000003';
const TEAM = '018f0000-0000-7000-8000-000000000010';
const envelope = (key: string) =>
  ({ key, secret: false, isSet: true, isDefault: false, updatedAt: null }) as const;

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('api client', () => {
  it('parses a successful response with the shared schema', async () => {
    server.use(
      route.get(`${BASE}/api/v1/setup/status`, () =>
        HttpResponse.json({ initialized: false, completedAt: null }),
      ),
    );
    const api = createApiClient({ fetch: absolute });
    await expect(api.setup.status()).resolves.toEqual({ initialized: false, completedAt: null });
  });

  it('sends the session cookie, JSON and an idempotency key on creates', async () => {
    const seen = vi.fn();
    server.use(
      route.post(`${BASE}/api/v1/teams`, async ({ request }) => {
        seen(request.headers.get('idempotency-key'), await request.json());
        return HttpResponse.json(
          {
            id: TEAM,
            name: 'Platform',
            color: null,
            leadUserId: null,
            defaultRoleId: ROLE,
            memberCount: 0,
            createdAt: '2026-10-07T09:00:00Z',
            updatedAt: '2026-10-07T09:00:00Z',
          },
          { status: 201 },
        );
      }),
    );
    const inits: RequestInit[] = [];
    const recording = (input: RequestInfo | URL, init?: RequestInit) => {
      if (init) inits.push(init);
      return absolute(input, init);
    };
    const api = createApiClient({ fetch: recording });
    await api.teams.create({ name: 'Platform', defaultRoleId: ROLE });
    const [key, body] = seen.mock.calls[0] ?? [];
    expect(inits[0]?.credentials).toBe('include');
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    expect(body).toEqual({ name: 'Platform', defaultRoleId: ROLE });
  });

  it('normalises the error body and surfaces the request id', async () => {
    server.use(
      route.get(`${BASE}/api/v1/me`, () =>
        HttpResponse.json(
          { code: 'unauthenticated', message: 'Sign in', requestId: 'req-7' },
          { status: 401 },
        ),
      ),
    );
    const onUnauthenticated = vi.fn();
    const api = createApiClient({ fetch: absolute, onUnauthenticated });
    const error = await api.auth.me().catch((caught: unknown) => caught);
    expect(error).toMatchObject({ status: 401, code: 'unauthenticated', requestId: 'req-7' });
    expect(onUnauthenticated).toHaveBeenCalledOnce();
  });

  it('falls back to the status and the x-request-id header for a bare failure', async () => {
    server.use(
      route.get(
        `${BASE}/api/v1/admin/system`,
        () => new HttpResponse('Bad gateway', { status: 502, headers: { 'x-request-id': 'r-9' } }),
      ),
    );
    const error = await createApiClient({ fetch: absolute })
      .system.health()
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({ status: 502, code: 'provider_error', requestId: 'r-9' });
  });

  it('reports a network failure and an unexpected body as typed errors', async () => {
    server.use(route.get(`${BASE}/api/v1/teams`, () => HttpResponse.error()));
    const api = createApiClient({ fetch: absolute });
    await expect(api.teams.list()).rejects.toMatchObject({ code: 'network_error', status: 0 });

    server.use(route.get(`${BASE}/api/v1/roles`, () => HttpResponse.json({ items: [{ id: 1 }] })));
    await expect(api.roles.list()).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('validates request bodies before sending them', async () => {
    const api = createApiClient({ fetch: absolute });
    const error = await api.auth
      .login({ email: 'not-an-email', password: 'x' })
      .catch((caught: unknown) => caught);
    expect(isApiError(error)).toBe(true);
    expect(fieldErrors(error)).toHaveProperty('email');
  });

  it('refuses cross-origin targets', () => {
    expect(() => createApiClient({ baseUrl: 'https://evil.example' })).toThrow(TypeError);
    const api = createApiClient();
    expect(() => api.http.url('//evil.example/x')).toThrow(TypeError);
  });

  it('builds the audit CSV link from filters, without paging', () => {
    const api = createApiClient();
    expect(api.audit.exportUrl({ action: 'user.invited', limit: 50 })).toBe(
      '/api/v1/audit-log?action=user.invited&format=csv',
    );
  });

  it('reads and writes one settings key, checking the value against its schema', async () => {
    let stored: unknown = 'Acme Labs';
    server.use(
      route.get(`${BASE}/api/v1/admin/settings/workspace.name`, () =>
        HttpResponse.json({ ...envelope('workspace.name'), value: stored }),
      ),
      route.put(`${BASE}/api/v1/admin/settings/workspace.name`, async ({ request }) => {
        stored = ((await request.json()) as { value: unknown }).value;
        return HttpResponse.json({ ...envelope('workspace.name'), value: stored });
      }),
      route.get(`${BASE}/api/v1/admin/settings/email.smtp.password`, () =>
        HttpResponse.json({ ...envelope('email.smtp.password'), secret: true }),
      ),
    );
    const api = createApiClient({ fetch: absolute });
    await api.settings.put('workspace.name', 'Acme');
    await expect(api.settings.get('workspace.name')).resolves.toMatchObject({ value: 'Acme' });
    await expect(api.settings.get('email.smtp.password')).resolves.toMatchObject({
      value: undefined,
      isSet: true,
    });
    await expect(api.settings.put('workspace.name', '')).rejects.toMatchObject({
      code: 'validation_failed',
    });
  });
});

describe('query keys', () => {
  it('maps realtime events to the queries they make stale', () => {
    expect(keysForEvent('notifications')).toEqual([queryKeys.notifications.all()]);
    expect(keysForEvent('module.enabled')).toContainEqual(queryKeys.modules());
    expect(keysForEvent('something.else')).toEqual([]);
  });
});
