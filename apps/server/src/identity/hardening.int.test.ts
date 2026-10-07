import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.ts';
import { TEST_ENV } from '../test-support.ts';
import { ADMIN, addPerson, call, createFirstAdmin, startHarness, type Harness } from './harness.ts';

describe('CSRF, headers, rate limits and the audit log against a real database', () => {
  let harness: Harness | undefined;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startHarness();
    if (started.available) harness = started.harness;
    else skipReason = started.reason;
  });
  afterAll(async () => harness?.stop());
  beforeEach(async () => harness?.reset());

  it('rejects cross-site writes that carry the session cookie', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app } = harness;
    const { cookie } = await createFirstAdmin(app);
    const body = { name: 'Growth' };
    const evil = await call(app, 'POST', '/teams', {
      cookie,
      body,
      origin: 'https://evil.example',
    });
    expect(evil.statusCode).toBe(403);
    expect(evil.json().code).toBe('forbidden');
    const missing = await call(app, 'POST', '/teams', { cookie, body, origin: null });
    expect(missing.statusCode).toBe(403);
    const fetchSite = await call(app, 'POST', '/teams', {
      cookie,
      body,
      headers: { 'sec-fetch-site': 'cross-site' },
    });
    expect(fetchSite.statusCode).toBe(403);
    const sameHost = await call(app, 'POST', '/teams', {
      cookie,
      body,
      origin: 'http://10.0.0.5:8080',
      headers: { host: '10.0.0.5:8080' },
    });
    expect(sameHost.statusCode).toBe(201);
    const reads = await call(app, 'GET', '/teams', { cookie, origin: 'https://evil.example' });
    expect(reads.statusCode).toBe(200);
  });

  it('sends a strict CSP, HSTS and no-framing headers', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const response = await harness.app.inject({ url: '/healthz' });
    const csp = String(response.headers['content-security-policy']);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['strict-transport-security']).toContain('max-age=63072000');
  });

  it('holds the per-IP sign-in budget across two replicas sharing the database', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const replicaA = harness.app;
    const replicaB = await harness.newApp();
    const attempt = (app: typeof replicaA) =>
      call(app, 'POST', '/auth/login', {
        body: { email: ADMIN.email, password: 'wrong password' },
      });
    for (let index = 0; index < 10; index += 1) {
      const response = await attempt(index % 2 === 0 ? replicaA : replicaB);
      expect(response.statusCode).toBe(401);
    }
    const limited = await attempt(replicaB);
    expect(limited.statusCode).toBe(429);
    expect(limited.json().code).toBe('rate_limited');
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    expect((await attempt(replicaA)).statusCode).toBe(429);
    const setup = await call(replicaA, 'GET', '/setup/status');
    expect(setup.statusCode).toBe(200);
  });

  it('counts signed-in traffic per person rather than per IP', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app, sql } = harness;
    const { cookie, userId } = await createFirstAdmin(app);
    await call(app, 'GET', '/me', { cookie });
    const keys = (
      await sql<{ key: string }[]>`select key from rate_limit_buckets order by key`
    ).map((row) => row.key);
    expect(keys).toContain(`global|user:${userId}`);
    expect(keys.some((key) => key.startsWith('POST /api/v1/setup/admin|ip:'))).toBe(true);
  });

  it('writes an audit row for each mutation and pages and exports them', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { app, sql } = harness;
    const { cookie } = await createFirstAdmin(app);
    await call(app, 'POST', '/teams', { cookie, body: { name: '=HYPERLINK("x")' } });
    const member = await addPerson(harness, cookie, { email: 'maya@acmelabs.dev', role: 'member' });
    expect((await call(app, 'POST', '/auth/login', { body: ADMIN })).statusCode).toBe(200);

    const first = await call(app, 'GET', '/audit-log?limit=2', { cookie });
    expect(first.statusCode).toBe(200);
    const page = first.json();
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toEqual(expect.any(String));
    const rest = await call(app, 'GET', `/audit-log?limit=200&cursor=${page.nextCursor}`, {
      cookie,
    });
    const actions = [...page.items, ...rest.json().items].map(
      (item: { action: string }) => item.action,
    );
    for (const action of [
      'setup.first_admin_created',
      'team.created',
      'invitation.created',
      'invitation.accepted',
      'user.created',
      'session.created',
    ]) {
      expect(actions).toContain(action);
    }
    expect(page.items[0].requestId).toEqual(expect.any(String));
    const [secrets] = await sql<{ count: number }[]>`
      select count(*)::int from audit_log
      where coalesce(before::text, '') || coalesce(after::text, '') ~* 'argon2|token_?hash'`;
    expect(secrets?.count).toBe(0);

    expect((await call(app, 'GET', '/audit-log', { cookie: member.cookie })).statusCode).toBe(403);
    const csv = await call(app, 'GET', '/audit-log?format=csv', { cookie: member.cookie });
    expect(csv.statusCode).toBe(403);
    const exported = await call(app, 'GET', '/audit-log?format=csv&action=team.created', {
      cookie,
    });
    expect(exported.headers['content-type']).toContain('text/csv');
    const lines = exported.body.trim().split('\r\n');
    expect(lines[0]).toMatch(/^id,createdAt,actorKind/);
    expect(lines).toHaveLength(2);
    expect(exported.body).toContain('""name"":""=HYPERLINK(');
    expect(exported.body).not.toMatch(/(^|,)"?=/m);
  });

  it('leaves the /metrics bearer token to the scrape route, not API token auth', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const token = 'm'.repeat(40);
    const app = await buildApp({
      env: { ...TEST_ENV, BEMMOLY_METRICS_TOKEN: token },
      modules: harness.modules,
      identity: harness.identity,
      logger: false,
    });
    try {
      const scrape = (authorization: string) =>
        app.inject({ url: '/metrics', headers: { authorization } });
      expect((await scrape(`Bearer ${token}`)).statusCode).toBe(200);
      expect((await scrape('Bearer wrong')).statusCode).toBe(401);
      const api = await call(app, 'GET', '/me', { token });
      expect(api.statusCode).toBe(401);
      expect(api.json().message).toMatch(/API token/);
    } finally {
      await app.close();
    }
  });
});
